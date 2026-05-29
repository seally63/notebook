// Sync engine contracts. The engine logic (engine.ts) is pure and adapter-driven so it
// can be unit-tested with in-memory adapters; on device the adapters are backed by
// op-sqlite (local) and supabase-js (remote).

export interface SyncRow {
  id: string;
  updated_at: string; // ISO-8601 UTC — last-write-wins key
  deleted: number; // soft-delete flag (0/1)
  synced?: number; // LOCAL ONLY (0 = needs push). Absent on remote rows.
  [column: string]: unknown;
}

export interface LocalAdapter {
  /** rows with synced = 0 (created/updated/deleted locally, not yet pushed) */
  getUnsynced(table: string): Promise<SyncRow[]>;
  /** flip synced = 1 after a successful push */
  markSynced(table: string, ids: string[]): Promise<void>;
  getById(table: string, id: string): Promise<SyncRow | undefined>;
  /** insert-or-replace an authoritative row from remote (caller sets synced = 1) */
  putFromRemote(table: string, row: SyncRow): Promise<void>;
  getLastPullAt(): string | null;
  setLastPullAt(iso: string): void | Promise<void>;
}

export interface RemoteAdapter {
  /** upsert by primary key (id); idempotent */
  upsertMany(table: string, rows: SyncRow[]): Promise<void>;
  /** rows where updated_at > sinceIso (or all if null) */
  fetchSince(table: string, sinceIso: string | null): Promise<SyncRow[]>;
}

export interface SyncResult {
  rows_pushed: number;
  rows_pulled: number;
  conflicts: number;
}

export type SyncLogger = (message: string) => void;
