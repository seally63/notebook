// Phase 0 placeholder for JournalList (`/`) — the WRITE home.
// Real TODAY block + entry list arrive in Phase 1. For now it proves: fonts render,
// the dock highlights WRITE, content clears the dock, and the back/close grammar works.

import React from 'react';
import { Text, ScrollView, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { useDockLayout } from '../components/dockLayout';
import { colors, radius, space } from '../theme/tokens';
import { text } from '../theme/typography';

function NavButton({ label, onPress, filled }: { label: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        height: 48,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        backgroundColor: filled ? colors.text : colors.surface,
        borderWidth: filled ? 0 : 1,
        borderColor: colors.rule,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text style={[text.monoButton, { color: filled ? colors.surface : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

export function JournalListScreen() {
  const navigation = useNavigation();
  const { clearance } = useDockLayout();

  return (
    <Screen padTop>
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: clearance }}>
        <Text style={text.monoLabel}>JOURNAL · WRITE</Text>
        <Text style={[text.hero, { marginTop: 8 }]}>Notebook.</Text>
        <Text style={[text.body, { color: colors.textSoft, marginTop: 10, lineHeight: 21 }]}>
          Phase 0 foundation. The dock below is the only global navigation — SEARCH · WRITE ·
          LATELY — and it highlights WRITE here.
        </Text>

        <Text style={[text.monoFieldLabel, { marginTop: space.l }]}>FONT CHECK</Text>
        <Text style={[text.lead, { marginTop: 8 }]}>Geist — write to remember.</Text>
        <Text style={[text.monoMicro, { marginTop: 6 }]}>GEIST MONO · 0123456789 · METADATA</Text>

        <Text style={[text.monoFieldLabel, { marginTop: space.l }]}>NAVIGATION GRAMMAR (§10.1)</Text>
        <NavButton label="OPEN PUSHED DETAIL ‹" onPress={() => navigation.navigate('DetailDemo')} filled />
        <NavButton label="OPEN MODAL ✕" onPress={() => navigation.navigate('ModalDemo')} />
      </ScrollView>
    </Screen>
  );
}
