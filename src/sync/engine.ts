// Sync engine — local-first, idempotent, background-only (must never block the UI).
//
//   pull: fetch rows where updated_at > last_pull_at; merge into local.
//   push: upload rows where synced = 0 (upsert by id), then mark synced = 1.
//   conflict: last-write-wins by updated_at. A locally-unsynced row overwritten by a
//             newer remote row is counted as a conflict (the local edit loses).
//   delete: propagates via the `deleted` flag (soft delete) — never hard-DELETE.
//
// ORDER: pull-then-push (per table). The brief's prose lists push first, but with a
// blind upsert that would let a STALE local row clobber a NEWER remote row, breaking
// last-write-wins. Pulling first merges remote with LWW, so only genuinely
// local-newer rows remain to push. (Resolved ambiguity — see Phase 0 deliverables.)
//
// Safe to run repeatedly. Every run logs counts (rows_pushed, rows_pulled, conflicts).

import { SYNC_TABLES, LOCAL_ONLY_COLUMNS, type SyncTable } from '../db/schema';
import type { LocalAdapter, RemoteAdapter, SyncResult, SyncRow, SyncLogger } from './types';

const defaultLogger: SyncLogger = (m) => console.log(m);

/** Drop local-only columns (`synced`) before uploading. */
export function stripLocalOnly(row: SyncRow): SyncRow {
  const out: SyncRow = { ...row };
  for (const col of LOCAL_ONLY_COLUMNS) delete out[col];
  return out;
}

/** Upload all locally-modified rows for one table. Returns count pushed. */
export async function pushTable(table: string, local: LocalAdapter, remote: RemoteAdapter): Promise<number> {
  const unsynced = await local.getUnsynced(table);
  if (unsynced.length === 0) return 0;
  await remote.upsertMany(table, unsynced.map(stripLocalOnly));
  await local.markSynced(table, unsynced.map((r) => r.id));
  return unsynced.length;
}

/** Merge remote changes for one table since the high-water mark. */
export async function pullTable(
  table: string,
  local: LocalAdapter,
  remote: RemoteAdapter,
): Promise<{ pulled: number; conflicts: number; maxUpdatedAt: string | null }> {
  const since = local.getLastPullAt();
  const remoteRows = await remote.fetchSince(table, since);
  let pulled = 0;
  let conflicts = 0;
  let maxUpdatedAt: string | null = since;

  for (const r of remoteRows) {
    const existing = await local.getById(table, r.id);

    if (!existing) {
      await local.putFromRemote(table, { ...r, synced: 1 });
      pulled++;
    } else if (r.updated_at > existing.updated_at) {
      // remote strictly newer → last-write-wins: remote overwrites local
      if (existing.synced === 0) conflicts++; // local had unpushed edits that now lose
      await local.putFromRemote(table, { ...r, synced: 1 });
      pulled++;
    }
    // else: local is newer-or-equal → keep local (idempotent no-op)

    if (!maxUpdatedAt || r.updated_at > maxUpdatedAt) maxUpdatedAt = r.updated_at;
  }

  return { pulled, conflicts, maxUpdatedAt };
}

/**
 * Full sync: for each table push then pull, using a single `last_pull_at` high-water
 * mark read once per table and advanced only at the end (so all tables see the same
 * `since`). Idempotent and safe to call on every NetInfo "online" event / mutation.
 */
export async function syncAll(
  local: LocalAdapter,
  remote: RemoteAdapter,
  options: { tables?: readonly string[]; log?: SyncLogger } = {},
): Promise<SyncResult> {
  const tables = options.tables ?? SYNC_TABLES;
  const log = options.log ?? defaultLogger;

  const result: SyncResult = { rows_pushed: 0, rows_pulled: 0, conflicts: 0 };
  let highWater = local.getLastPullAt();

  for (const table of tables) {
    // pull first (LWW merge), then push only the rows that survive as local-newer
    const { pulled, conflicts, maxUpdatedAt } = await pullTable(table, local, remote);
    const pushed = await pushTable(table, local, remote);
    result.rows_pushed += pushed;
    result.rows_pulled += pulled;
    result.conflicts += conflicts;
    if (maxUpdatedAt && (!highWater || maxUpdatedAt > highWater)) highWater = maxUpdatedAt;
  }

  if (highWater && highWater !== local.getLastPullAt()) {
    await local.setLastPullAt(highWater);
  }

  log(`[sync] rows_pushed=${result.rows_pushed} rows_pulled=${result.rows_pulled} conflicts=${result.conflicts}`);
  return result;
}

export type { SyncTable };
