// Settings (`/settings`) — modal (close-X), reached from Lately's ☰. Carbon row-grid.
// Real actions only (no cosmetic toggles): ACCOUNT (email + sign out / sign in), LIBRARY
// (All people / All phrases — the durable doors), LANGUAGES (what you're learning, derived
// from people), DATA (export Markdown · delete notebook), ABOUT (version).

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { colors, fonts, tracking } from '../theme/tokens';
import { text } from '../theme/typography';
import { langShort, langName } from '../lib/lang';
import { useAuth } from '../auth/AuthContext';
import { listPeople } from '../data/people';
import { listPhrases } from '../data/phrases';
import { exportAllEntries, deleteNotebook } from '../data/maintenance';
import type { PersonRow, PhraseRow } from '../db/schema';

const APP_VERSION = '0.1 · build 4';

interface LangAgg {
  code: string;
  short: string;
  name: string;
  people: PersonRow[];
  phraseCount: number;
}

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export function SettingsScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [phrases, setPhrases] = useState<PhraseRow[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const [ppl, phr] = await Promise.all([listPeople(), listPhrases()]);
    setPeople(ppl);
    setPhrases(phr);
  }, []);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // languages learning — grouped from people who have a lang, with phrase counts
  const langs: LangAgg[] = [];
  const seen = new Map<string, LangAgg>();
  for (const p of people) {
    if (!p.lang) continue;
    const key = p.lang.slice(0, 2).toLowerCase();
    let agg = seen.get(key);
    if (!agg) {
      agg = { code: langShort(p.lang) ?? key.toUpperCase(), short: langShort(p.lang) ?? '', name: langName(p.lang) ?? '', people: [], phraseCount: 0 };
      seen.set(key, agg);
      langs.push(agg);
    }
    agg.people.push(p);
  }
  for (const ph of phrases) {
    if (!ph.lang) continue;
    const agg = seen.get(ph.lang.slice(0, 2).toLowerCase());
    if (agg) agg.phraseCount++;
  }

  const onSignOut = async () => {
    await signOut();
    Alert.alert('Signed out', 'You’re back to writing locally. Your entries stay on this device.');
  };

  const onExport = async () => {
    setBusy(true);
    try {
      const n = await exportAllEntries();
      if (n === 0) Alert.alert('Nothing to export', 'Write an entry first.');
    } catch (e) {
      Alert.alert('Export failed', (e as Error).message ?? 'Could not export.');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Delete this notebook?',
      user
        ? 'Erases all entries, people, and phrases on THIS device. Your synced cloud copy is kept — signing in again restores it.'
        : 'Erases all entries, people, and phrases on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await deleteNotebook();
            await reload();
            Alert.alert('Notebook cleared', 'Everything on this device has been removed.');
          },
        },
      ],
    );
  };

  return (
    <Screen padTop>
      {/* close-X header */}
      <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Close">
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
        <Text style={[text.monoLabel, { color: colors.text }]}>SETTINGS</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {/* ACCOUNT */}
        <Section label="ACCOUNT" trailing={user ? 'SIGNED IN' : 'LOCAL'}>
          {user ? (
            <>
              <Row label="Email" value={user.email ?? '—'} />
              <Row label="Sign out" accent onPress={onSignOut} arrow />
            </>
          ) : (
            <>
              <Row label="Sign in" accent onPress={() => navigation.navigate('SignIn')} arrow />
              <Row label="Create account" accent onPress={() => navigation.navigate('Register')} arrow />
            </>
          )}
        </Section>

        {/* LIBRARY */}
        <Section label="LIBRARY" trailing="BROWSE ALL">
          <Row label="All people" value={`${people.length}`} chev onPress={() => navigation.navigate('People')} />
          <Row label="All phrases" value={`${phrases.length}`} chev onPress={() => navigation.navigate('Phrases')} />
        </Section>

        {/* LANGUAGES */}
        {langs.length > 0 && (
          <Section label="LANGUAGES" trailing={`LEARNING ${langs.length}`}>
            {langs.map((l) => (
              <View key={l.code} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.ruleSoft }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={{ fontFamily: fonts.mono.medium, fontSize: 11, color: colors.accent, letterSpacing: tracking(11, 0.12) }}>{l.short}</Text>
                    <Text style={[text.body]}>{l.name}</Text>
                  </View>
                  <Text style={[text.monoMicro, { fontSize: 10 }]}>{l.phraseCount} PHRASES</Text>
                </View>
                <Text style={[text.monoMicro, { fontSize: 10.5, textTransform: 'none', marginTop: 4 }]} numberOfLines={1}>
                  for {l.people.map((p) => `[${p.name.toLowerCase()}]`).join(', ')}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {/* DATA */}
        <Section label="DATA" trailing="LOCAL FIRST">
          <Row label={busy ? 'Exporting…' : 'Export all entries'} value=".md" chev onPress={busy ? undefined : onExport} />
          <Row label="Delete this notebook" accent onPress={onDelete} arrow />
        </Section>

        {/* ABOUT */}
        <Section label="ABOUT" trailing="">
          <Row label="Version" value={APP_VERSION} />
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ label, trailing, children }: { label: string; trailing?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
        <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.text, letterSpacing: tracking(10, 0.14) }}>{label}</Text>
        {!!trailing && <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.accent, letterSpacing: tracking(10, 0.12) }}>{trailing}</Text>}
      </View>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  accent,
  chev,
  arrow,
  onPress,
}: {
  label: string;
  value?: string;
  accent?: boolean;
  chev?: boolean;
  arrow?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: colors.ruleSoft,
        opacity: pressed && onPress ? 0.6 : 1,
      })}>
      <Text style={[text.body, { fontSize: 13.5, color: accent ? colors.accent : colors.text }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {!!value && <Text style={[text.monoMicro, { fontSize: 11, textTransform: 'none' }]}>{value}</Text>}
        {arrow && <Icon name="arrowR" size={13} color={accent ? colors.accent : colors.muted} />}
        {chev && <Icon name="chev" size={13} color={colors.mutedSoft} />}
      </View>
    </Pressable>
  );
}
