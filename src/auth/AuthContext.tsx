// Auth state (email + password via Supabase). Local-first + SKIPPABLE: the app runs
// without it. When unconfigured (no Supabase env) or signed out, the journal still
// works against local SQLite; sign-in activates sync and back-fills local rows.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../services/supabase';
import { setCurrentUserId } from '../data/session';
import { backfillLocalUserId } from './backfill';
import { triggerSync } from '../sync/runSync';

interface AuthApi {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configured: boolean;
  signUp(email: string, password: string, name?: string): Promise<{ error?: string; needsConfirmation?: boolean }>;
  signIn(email: string, password: string): Promise<{ error?: string }>;
  signOut(): Promise<void>;
}

const AuthCtx = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth must be used within <AuthProvider>');
  return c;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((s: Session | null) => {
    setSession(s);
    setCurrentUserId(s?.user?.id ?? null);
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      apply(data.session);
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, s) => {
      apply(s);
      if (event === 'SIGNED_IN' && s?.user) {
        backfillLocalUserId(s.user.id).then(() => triggerSync('signed-in'));
      }
    });

    // RN gotcha: autoRefreshToken only ticks while we tell the client the app is in focus.
    // Without this, the access token expires (~1h) and never refreshes, so Edge Function
    // calls 401. Drive start/stop off AppState; refresh immediately on foreground.
    sb.auth.startAutoRefresh();
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        sb.auth.startAutoRefresh();
        sb.auth.getSession(); // proactively refresh a stale token on resume
      } else {
        sb.auth.stopAutoRefresh();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      appSub.remove();
      sb.auth.stopAutoRefresh();
    };
  }, [apply]);

  const signUp = useCallback<AuthApi['signUp']>(async (email, password, name) => {
    const sb = getSupabase();
    if (!sb) return { error: 'Sync is not configured on this build.' };
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: name ? { data: { name } } : undefined,
    });
    if (error) return { error: error.message };
    return { needsConfirmation: !data.session }; // email-confirm flow returns no session
  }, []);

  const signIn = useCallback<AuthApi['signIn']>(async (email, password) => {
    const sb = getSupabase();
    if (!sb) return { error: 'Sync is not configured on this build.' };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback<AuthApi['signOut']>(async () => {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    apply(null);
  }, [apply]);

  return (
    <AuthCtx.Provider
      value={{ session, user: session?.user ?? null, loading, configured: isSupabaseConfigured, signUp, signIn, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}
