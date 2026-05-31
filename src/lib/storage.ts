// MMKV — synchronous key-value store for sync bookkeeping (last-pull timestamps) and
// the Supabase auth session. Chosen over AsyncStorage for speed + sync access.

import { createMMKV, type MMKV } from 'react-native-mmkv';

// MMKV v4 (Nitro): instances come from the createMMKV() factory; `MMKV` is a type.
export const kv: MMKV = createMMKV({ id: 'notebook' });

// Keys used across the app.
export const KV = {
  lastPullAt: 'sync.lastPullAt', // ISO string — high-water mark for incremental pull
  onboarded: 'app.onboarded', // user has entered the app (signed in or skipped)
} as const;

/**
 * Supabase auth needs a storage adapter. MMKV is synchronous; supabase-js accepts
 * sync return values from getItem/setItem/removeItem.
 */
export const mmkvSupabaseStorage = {
  getItem: (key: string): string | null => kv.getString(key) ?? null,
  setItem: (key: string, value: string): void => kv.set(key, value),
  removeItem: (key: string): void => {
    kv.remove(key);
  },
};
