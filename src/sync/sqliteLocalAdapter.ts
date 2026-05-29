// LocalAdapter backed by op-sqlite (device only — imports the native DB).
// Validates table names against the known set (the table is interpolated into SQL,
// columns are always parameterised).

import { exec, selectAll } from '../db/sqlite';
import { SYNC_TABLES } from '../db/schema';
import { kv, KV } from '../lib/storage';
import { toLocal } from './convert';
import type { LocalAdapter, SyncRow } from './types';

function assertTable(table: string): void {
  if (!(SYNC_TABLES as readonly string[]).includes(table)) {
    throw new Error(`[sync] unknown table: ${table}`);
  }
}

export const sqliteLocalAdapter: LocalAdapter = {
  async getUnsynced(table) {
    assertTable(table);
    return selectAll<SyncRow>(`SELECT * FROM ${table} WHERE synced = 0`);
  },

  async markSynced(table, ids) {
    assertTable(table);
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await exec(`UPDATE ${table} SET synced = 1 WHERE id IN (${placeholders})`, ids);
  },

  async getById(table, id) {
    assertTable(table);
    const rows = await selectAll<SyncRow>(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [id]);
    return rows[0];
  },

  async putFromRemote(table, row) {
    assertTable(table);
    const local = toLocal(table, row); // booleans→0/1, json→string
    const cols = Object.keys(local);
    const placeholders = cols.map(() => '?').join(',');
    const values = cols.map((c) => local[c] as any);
    await exec(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`, values);
  },

  getLastPullAt() {
    return kv.getString(KV.lastPullAt) ?? null;
  },

  setLastPullAt(iso) {
    kv.set(KV.lastPullAt, iso);
  },
};
