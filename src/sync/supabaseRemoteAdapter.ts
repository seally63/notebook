// RemoteAdapter backed by supabase-js (device only). Converts SQLite-shaped rows to
// Postgres shape on upload and returns Postgres rows verbatim on fetch (the engine
// hands them to LocalAdapter.putFromRemote, which converts back).

import type { SupabaseClient } from '@supabase/supabase-js';
import { toRemote } from './convert';
import type { RemoteAdapter, SyncRow } from './types';

export function makeSupabaseRemoteAdapter(client: SupabaseClient): RemoteAdapter {
  return {
    async upsertMany(table, rows) {
      if (rows.length === 0) return;
      const payload = rows.map((r) => toRemote(table, r));
      const { error } = await client.from(table).upsert(payload, { onConflict: 'id' });
      if (error) throw new Error(`[sync] upsert ${table}: ${error.message}`);
    },

    async fetchSince(table, sinceIso) {
      let query = client.from(table).select('*').order('updated_at', { ascending: true });
      if (sinceIso) query = query.gt('updated_at', sinceIso);
      const { data, error } = await query;
      if (error) throw new Error(`[sync] fetch ${table}: ${error.message}`);
      return (data ?? []) as SyncRow[];
    },
  };
}
