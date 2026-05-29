// Sync engine unit tests (Phase 0 acceptance). In-memory adapters stand in for
// op-sqlite (local) and supabase-js (remote). Covers: push, pull, last-write-wins,
// soft-delete propagation, conflict counting, idempotency.

import { syncAll, stripLocalOnly } from '../src/sync/engine';
import type { LocalAdapter, RemoteAdapter, SyncRow } from '../src/sync/types';

const T1 = '2026-01-01T00:00:00.000Z';
const T2 = '2026-01-02T00:00:00.000Z';
const T3 = '2026-01-03T00:00:00.000Z';
const silent = () => {};

class InMemoryLocal implements LocalAdapter {
  tables: Record<string, Map<string, SyncRow>> = {};
  lastPullAt: string | null = null;

  private t(table: string) {
    return (this.tables[table] ??= new Map());
  }
  // test helper
  seed(table: string, row: SyncRow) {
    this.t(table).set(row.id, { ...row });
  }
  all(table: string) {
    return [...this.t(table).values()];
  }
  async getUnsynced(table: string) {
    return this.all(table).filter((r) => r.synced === 0);
  }
  async markSynced(table: string, ids: string[]) {
    for (const id of ids) {
      const r = this.t(table).get(id);
      if (r) r.synced = 1;
    }
  }
  async getById(table: string, id: string) {
    return this.t(table).get(id);
  }
  async putFromRemote(table: string, row: SyncRow) {
    this.t(table).set(row.id, { ...row });
  }
  getLastPullAt() {
    return this.lastPullAt;
  }
  setLastPullAt(iso: string) {
    this.lastPullAt = iso;
  }
}

class InMemoryRemote implements RemoteAdapter {
  tables: Record<string, Map<string, SyncRow>> = {};
  sawSyncedColumn = false;

  private t(table: string) {
    return (this.tables[table] ??= new Map());
  }
  seed(table: string, row: SyncRow) {
    this.t(table).set(row.id, { ...row });
  }
  get(table: string, id: string) {
    return this.t(table).get(id);
  }
  async upsertMany(table: string, rows: SyncRow[]) {
    for (const r of rows) {
      if ('synced' in r) this.sawSyncedColumn = true;
      this.t(table).set(r.id, { ...r });
    }
  }
  async fetchSince(table: string, since: string | null) {
    return this.all(table).filter((r) => since == null || r.updated_at > since);
  }
  all(table: string) {
    return [...this.t(table).values()];
  }
}

const person = (id: string, updated_at: string, synced: 0 | 1, extra: Partial<SyncRow> = {}): SyncRow => ({
  id,
  name: id.toUpperCase(),
  updated_at,
  deleted: 0,
  synced,
  ...extra,
});

const opts = (tables: string[]) => ({ tables, log: silent });

describe('sync engine', () => {
  test('push: uploads unsynced local rows, marks them synced, strips local-only columns', async () => {
    const local = new InMemoryLocal();
    const remote = new InMemoryRemote();
    local.seed('people', person('a', T1, 0));

    const res = await syncAll(local, remote, opts(['people']));

    expect(res.rows_pushed).toBe(1);
    expect(remote.get('people', 'a')).toBeDefined();
    expect('synced' in remote.get('people', 'a')!).toBe(false); // local-only stripped
    expect(remote.sawSyncedColumn).toBe(false);
    expect(local.all('people')[0].synced).toBe(1);
  });

  test('pull: inserts new remote rows locally with synced=1 and advances last_pull_at', async () => {
    const local = new InMemoryLocal();
    const remote = new InMemoryRemote();
    remote.seed('people', person('b', T2, 1));

    const res = await syncAll(local, remote, opts(['people']));

    expect(res.rows_pulled).toBe(1);
    const b = await local.getById('people', 'b');
    expect(b?.synced).toBe(1);
    expect(local.getLastPullAt()).toBe(T2);
  });

  test('last-write-wins: newer remote overwrites older local', async () => {
    const local = new InMemoryLocal();
    const remote = new InMemoryRemote();
    local.seed('people', person('c', T1, 1, { name: 'local-old' }));
    remote.seed('people', person('c', T2, 1, { name: 'remote-new' }));

    await syncAll(local, remote, opts(['people']));

    expect((await local.getById('people', 'c'))?.name).toBe('remote-new');
  });

  test('last-write-wins: newer local is kept and pushed (remote does not clobber it)', async () => {
    const local = new InMemoryLocal();
    const remote = new InMemoryRemote();
    local.seed('people', person('d', T2, 0, { name: 'local-new' }));
    remote.seed('people', person('d', T1, 1, { name: 'remote-old' }));

    const res = await syncAll(local, remote, opts(['people']));

    expect((await local.getById('people', 'd'))?.name).toBe('local-new');
    expect(remote.get('people', 'd')?.name).toBe('local-new'); // pushed up
    expect(res.conflicts).toBe(0);
  });

  test('conflict: a locally-unsynced row overwritten by a newer remote row is counted', async () => {
    const local = new InMemoryLocal();
    const remote = new InMemoryRemote();
    local.seed('people', person('e', T1, 0, { name: 'local-edit' })); // unsynced local edit
    remote.seed('people', person('e', T2, 1, { name: 'remote-wins' })); // newer remote

    const res = await syncAll(local, remote, opts(['people']));

    expect(res.conflicts).toBe(1);
    expect((await local.getById('people', 'e'))?.name).toBe('remote-wins');
  });

  test('soft-delete propagates both directions (never hard-deletes)', async () => {
    const local = new InMemoryLocal();
    const remote = new InMemoryRemote();
    // local delete → pushes up
    local.seed('people', person('f', T1, 0, { deleted: 1 }));
    // remote delete (newer) → overwrites local
    local.seed('people', person('g', T1, 1));
    remote.seed('people', person('g', T2, 1, { deleted: 1 }));

    await syncAll(local, remote, opts(['people']));

    expect(remote.get('people', 'f')?.deleted).toBe(1); // row still exists, flagged
    expect((await local.getById('people', 'g'))?.deleted).toBe(1);
  });

  test('idempotency: a second sync with no changes does nothing', async () => {
    const local = new InMemoryLocal();
    const remote = new InMemoryRemote();
    local.seed('people', person('a', T2, 0));
    remote.seed('people', person('b', T3, 1));

    await syncAll(local, remote, opts(['people']));
    const second = await syncAll(local, remote, opts(['people']));

    expect(second).toEqual({ rows_pushed: 0, rows_pulled: 0, conflicts: 0 });
  });

  test('multi-table sync aggregates counts across tables', async () => {
    const local = new InMemoryLocal();
    const remote = new InMemoryRemote();
    local.seed('people', person('p1', T1, 0));
    local.seed('phrases', { id: 'ph1', en: 'hi', updated_at: T1, deleted: 0, synced: 0 });
    remote.seed('entries', { id: 'en1', date: '2026-01-01', nodes: '[]', updated_at: T2, deleted: 0 });

    const res = await syncAll(local, remote, opts(['people', 'phrases', 'entries', 'drafts']));

    expect(res.rows_pushed).toBe(2);
    expect(res.rows_pulled).toBe(1);
  });

  test('stripLocalOnly removes synced but preserves everything else', () => {
    const out = stripLocalOnly({ id: 'x', updated_at: T1, deleted: 0, synced: 0, name: 'X' });
    expect(out).toEqual({ id: 'x', updated_at: T1, deleted: 0, name: 'X' });
  });
});
