// Root native-stack: onboarding (auth) + the home tabs + pushed screens (§1).
// We render our own chrome, so the native header is always hidden. Initial route is
// gated on the local "onboarded" flag (set on sign-in / sign-up / skip) — the app is
// local-first, so returning users land straight on the journal.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { HomeTabs } from './HomeTabs';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { WriteScreen } from '../screens/WriteScreen';
import { EntryScreen } from '../screens/EntryScreen';
import { PeopleListScreen } from '../screens/PeopleListScreen';
import { PersonDetailScreen } from '../screens/PersonDetailScreen';
import { PersonNewScreen } from '../screens/PersonNewScreen';
import { PhrasesListScreen } from '../screens/PhrasesListScreen';
import { PhraseNewScreen } from '../screens/PhraseNewScreen';
import { PhrasePracticeScreen } from '../screens/PhrasePracticeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { kv, KV } from '../lib/storage';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const initial = kv.getBoolean(KV.onboarded) ? 'Home' : 'Welcome';
  return (
    <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Home" component={HomeTabs} />
      <Stack.Screen name="Compose" component={WriteScreen} />
      <Stack.Screen name="Entry" component={EntryScreen} />
      <Stack.Screen name="People" component={PeopleListScreen} />
      <Stack.Screen name="PersonDetail" component={PersonDetailScreen} />
      <Stack.Screen name="PersonNew" component={PersonNewScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Phrases" component={PhrasesListScreen} />
      <Stack.Screen name="PhraseNew" component={PhraseNewScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="PhrasePractice" component={PhrasePracticeScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
