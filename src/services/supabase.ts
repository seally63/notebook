// Supabase client — auth + Postgres + Storage + Edge Functions. Lazily created, and
// ONLY when env is configured (the app is local-first and runs fully without it).
// Session is persisted in MMKV (no AsyncStorage dependency).

import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey, isSupabaseConfigured } from '../lib/env';
import { mmkvSupabaseStorage } from '../lib/storage';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: mmkvSupabaseStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // no URL-based session in RN
      },
    });
  }
  return _client;
}

/**
 * Invoke an Edge Function with a self-healing auth retry. If the call fails with an auth
 * error (stale/expired JWT — the RN "non-2xx 401" case), force a session refresh and retry
 * once. Returns the same { data, error } shape as functions.invoke.
 */
export async function invokeFn<T = any>(
  fn: string,
  body: unknown,
): Promise<{ data: T | null; error: any }> {
  const sb = getSupabase();
  if (!sb) return { data: null, error: new Error('supabase not configured') };

  const isAuthError = (err: any): boolean => {
    const ctx = err?.context as Response | undefined;
    return ctx?.status === 401 || ctx?.status === 403 || /jwt|auth|401|403/i.test(err?.message ?? '');
  };

  let res = await sb.functions.invoke<T>(fn, { body });
  if (res.error && isAuthError(res.error)) {
    await sb.auth.getSession(); // forces a refresh if the token is expired
    res = await sb.functions.invoke<T>(fn, { body });
  }
  return res;
}

export { isSupabaseConfigured };
