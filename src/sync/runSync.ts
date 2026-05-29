// Sync orchestrator — wires the device adapters to the engine and guards execution:
//   - no-op unless Supabase is configured, online, and signed in (RLS needs a session)
//   - single-flight mutex so overlapping triggers don't race
//   - fire-and-forget API (triggerSync) so callers / the UI never block on it
//
// Triggered on app start, on NetInfo "online", and (later phases) after each mutation.

import { getSupabase, isSupabaseConfigured } from '../services/supabase';
import { isOnline, onConnectivityChange } from '../services/netinfo';
import { sqliteLocalAdapter } from './sqliteLocalAdapter';
import { makeSupabaseRemoteAdapter } from './supabaseRemoteAdapter';
import { syncAll } from './engine';
import type { SyncResult } from './types';

let running = false;

export async function runSync(reason = 'manual'): Promise<SyncResult | null> {
  if (!isSupabaseConfigured || !isOnline()) return null;
  const client = getSupabase();
  if (!client) return null;

  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) return null; // signed out → local-only

  if (running) return null;
  running = true;
  try {
    const remote = makeSupabaseRemoteAdapter(client);
    return await syncAll(sqliteLocalAdapter, remote, {
      log: (m) => console.log(`${m} (${reason})`),
    });
  } catch (e) {
    console.warn('[sync] failed:', (e as Error).message);
    return null;
  } finally {
    running = false;
  }
}

/** fire-and-forget — never blocks the caller/UI */
export function triggerSync(reason?: string): void {
  runSync(reason).catch(() => {});
}

/** subscribe sync to connectivity; returns unsubscribe */
export function initSyncOnConnectivity(): () => void {
  return onConnectivityChange((online) => {
    if (online) triggerSync('online');
  });
}
