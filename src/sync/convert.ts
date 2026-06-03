// SQLite ↔ Postgres impedance conversion.
//   SQLite: booleans are 0/1 integers; JSONB columns (nodes) are TEXT.
//   Postgres (via supabase-js): booleans are true/false; jsonb is a parsed object.
// toLocal:  a remote (Postgres) row → SQLite shape (booleans→0/1, json→string)
// toRemote: a local (SQLite) row    → Postgres shape (0/1→boolean, string→json)

import type { SyncRow } from './types';

// Boolean columns per table (incl. local-only `synced`, which is stripped before
// upload anyway so it never reaches toRemote).
const BOOL_COLS: Record<string, string[]> = {
  people: ['deleted', 'synced'],
  phrases: ['tgt_edited', 'pending_translation', 'pending_audio', 'deleted', 'synced'],
  entries: ['deleted', 'synced'],
  drafts: ['deleted', 'synced'],
};

// jsonb columns stored as TEXT in SQLite.
const JSON_COLS: Record<string, string[]> = {
  entries: ['nodes'],
  drafts: ['nodes'],
  phrases: ['variants'],
};

export function toLocal(table: string, row: SyncRow): SyncRow {
  const out: SyncRow = { ...row };
  for (const c of BOOL_COLS[table] ?? []) {
    if (c in out) out[c] = out[c] ? 1 : 0;
  }
  for (const c of JSON_COLS[table] ?? []) {
    if (c in out) out[c] = typeof out[c] === 'string' ? out[c] : JSON.stringify(out[c] ?? []);
  }
  return out;
}

export function toRemote(table: string, row: SyncRow): SyncRow {
  const out: SyncRow = { ...row };
  for (const c of BOOL_COLS[table] ?? []) {
    if (c === 'synced') continue; // local-only
    if (c in out) out[c] = !!out[c];
  }
  for (const c of JSON_COLS[table] ?? []) {
    if (c in out && typeof out[c] === 'string') {
      try {
        out[c] = JSON.parse(out[c] as string);
      } catch {
        out[c] = [];
      }
    }
  }
  return out;
}
