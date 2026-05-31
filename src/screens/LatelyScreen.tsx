// Phase 0/1 placeholder for Lately (`/lately`) — dock·LATELY.
// Real 4-week calendar + carry-overs + quiet rows arrive in Phase 4, as does the full
// Settings screen (via the ☰). Until then, this hosts a minimal ACCOUNT block so a
// user who skipped onboarding can still sign in / create an account later (the brief's
// "sign-in activates sync + back-fills local data" path).

import React from 'react';
import { Text, ScrollView, View, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { useDockLayout } from '../components/dockLayout';
import { colors } from '../theme/tokens';
import { text } from '../theme/typography';
import { useAuth } from '../auth/AuthContext';

export function LatelyScreen() {
  const { clearance } = useDockLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, signOut } = useAuth();

  const onSignOut = async () => {
    await signOut();
    Alert.alert('Signed out', 'You’re back to writing locally. Your entries stay on this device.');
  };

  return (
    <Screen padTop>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: clearance }}>
        <Text style={[text.monoLabel, { marginTop: 8 }]}>LATELY</Text>
        <Text style={[text.title, { marginTop: 8 }]}>A relational overview.</Text>
        <Text style={[text.body, { color: colors.textSoft, marginTop: 10, lineHeight: 21 }]}>
          Who you’re thinking about, and who’s gone quiet. The 4-week calendar, carry-overs, and Settings
          arrive in Phase 4.
        </Text>

        {/* ACCOUNT — interim home for sign-in/out until Settings (Phase 4) */}
        <View style={{ marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.rule }}>
          <Text style={[text.monoFieldLabel]}>ACCOUNT</Text>

          {user ? (
            <>
              <Text style={[text.body, { color: colors.text, marginTop: 10 }]}>{user.email}</Text>
              <Text style={[text.monoMicro, { fontSize: 10, marginTop: 4, textTransform: 'none' }]}>
                Synced across your devices.
              </Text>
              <Pressable onPress={onSignOut} hitSlop={8} style={{ marginTop: 16 }}>
                <Text style={[text.monoButton, { fontSize: 11, color: colors.accent }]}>SIGN OUT</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[text.body, { color: colors.textSoft, marginTop: 10, lineHeight: 21 }]}>
                You’re writing locally. Sign in to back up and sync across devices — your existing entries
                come with you.
              </Text>
              <View style={{ flexDirection: 'row', gap: 22, marginTop: 16 }}>
                <Text
                  onPress={() => navigation.navigate('SignIn')}
                  style={[text.monoButton, { fontSize: 11, color: colors.accent }]}>
                  SIGN IN ↗
                </Text>
                <Text
                  onPress={() => navigation.navigate('Register')}
                  style={[text.monoButton, { fontSize: 11, color: colors.accent }]}>
                  CREATE ACCOUNT ↗
                </Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
