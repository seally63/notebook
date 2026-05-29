/**
 * Notebook — a journal-first relationship & language companion.
 * Local-first (on-device SQLite is the source of truth); Supabase is a sync layer.
 *
 * @format
 */

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initDatabase } from './src/db/sqlite';
import { initConnectivity } from './src/services/netinfo';
import { initSyncOnConnectivity, triggerSync } from './src/sync/runSync';
import { isSupabaseConfigured } from './src/services/supabase';

function App(): React.JSX.Element {
  useEffect(() => {
    let unsubNet: (() => void) | undefined;
    let unsubSync: (() => void) | undefined;

    initDatabase()
      .then(() => {
        unsubSync = initSyncOnConnectivity();
        unsubNet = initConnectivity();
        triggerSync('startup');
        console.log(`[app] ready · supabase configured: ${isSupabaseConfigured}`);
      })
      .catch((e) => console.error('[app] init failed:', e));

    return () => {
      unsubNet?.();
      unsubSync?.();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
