/**
 * Notebook — a journal-first relationship & language companion.
 * Local-first (on-device SQLite is the source of truth); Supabase is a sync layer.
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AuthProvider } from './src/auth/AuthContext';
import { initDatabase } from './src/db/sqlite';
import { initConnectivity, onConnectivityChange } from './src/services/netinfo';
import { initSyncOnConnectivity, triggerSync } from './src/sync/runSync';
import { isSupabaseConfigured } from './src/services/supabase';
import { resolvePendingPhrases } from './src/data/phrases';
import { colors } from './src/theme/tokens';

function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsubNet: (() => void) | undefined;
    let unsubSync: (() => void) | undefined;
    let unsubPhrase: (() => void) | undefined;

    (async () => {
      try {
        await initDatabase();
      } catch (e) {
        console.error('[app] init failed:', e);
      }
      setReady(true);
      unsubSync = initSyncOnConnectivity();
      unsubNet = initConnectivity();
      triggerSync('startup');
      // §12: fill in any phrases still pending translation/audio (offline-create retry).
      resolvePendingPhrases().catch(() => {});
      unsubPhrase = onConnectivityChange((online) => {
        if (online) resolvePendingPhrases().catch(() => {});
      });
      console.log(`[app] ready · supabase configured: ${isSupabaseConfigured}`);
    })();

    return () => {
      unsubNet?.();
      unsubSync?.();
      unsubPhrase?.();
    };
  }, []);

  return (
    <SafeAreaProvider>
      {ready ? (
        <AuthProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.bg }} />
      )}
    </SafeAreaProvider>
  );
}

export default App;
