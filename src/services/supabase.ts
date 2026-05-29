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

export { isSupabaseConfigured };
