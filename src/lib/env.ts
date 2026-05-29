// Centralised access to build-time env (via react-native-dotenv `@env`).
// The app is local-first: it must boot and function offline WITHOUT Supabase config.
// `isSupabaseConfigured` gates sync + Edge Function calls.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

const PLACEHOLDER_URL = 'https://YOUR-PROJECT-ref.supabase.co';
const PLACEHOLDER_KEY = 'YOUR-PUBLIC-ANON-KEY';

export const supabaseUrl = SUPABASE_URL ?? '';
export const supabaseAnonKey = SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured: boolean =
  supabaseUrl.length > 0 &&
  supabaseAnonKey.length > 0 &&
  supabaseUrl !== PLACEHOLDER_URL &&
  supabaseAnonKey !== PLACEHOLDER_KEY &&
  supabaseUrl.startsWith('https://');
