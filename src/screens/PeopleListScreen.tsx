// /people — the People library (notebook-people.jsx → PeopleList). No dock; reached via
// Search, Settings·LIBRARY, and inline [name] taps. Header "PEOPLE · NN" + "+ NEW".
// Live name/context filter, alphabetical letter sections, rows → /people/:id.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/Icon';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { dayMonthLabel } from '../lib/format';
import { langShort } from '../lib/lang';
import { personHint, duplicateNameSet } from '../lib/personHint';
import { listPeople } from '../data/people';
import { listPhrases } from '../data/phrases';
import type { PersonRow } from '../db/schema';

type Props = NativeStackScreenProps<RootStackParamList, 'People'>;

export function PeopleListScreen({ navigation }: Props) {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [phraseCounts, setPhraseCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const [ppl, phrases] = await Promise.all([listPeople(), listPhrases()]);
        if (!alive) return;
        const counts: Record<string, number> = {};
        for (const ph of phrases) if (ph.for_person) counts[ph.for_person] = (counts[ph.for_person] ?? 0) + 1;
        setPeople(ppl);
        setPhraseCounts(counts);
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q) || (p.context ?? '').toLowerCase().includes(q));
  }, [people, query]);
  const duplicates = useMemo(() => duplicateNameSet(filtered), [filtered]);

  return (
    <Screen>
      <ScreenHeader
        title={`PEOPLE · ${String(people.length).padStart(2, '0')}`}
        leading="back"
        onLeading={() => navigation.goBack()}
        trailing={<Text style={[text.monoButton, { fontSize: 11, color: colors.accent }]}>+ NEW</Text>}
        onTrailing={() => navigation.navigate('PersonNew')}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {/* search */}
        <View
          style={{
            marginTop: 4,
            marginBottom: 8,
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: radius.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}>
          <Icon name="search" size={14} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="SEARCH NAME, CONTEXT…"
            placeholderTextColor={colors.mutedSoft}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              padding: 0,
              fontFamily: fonts.mono.regular,
              fontSize: 11,
              letterSpacing: 0.5,
              color: colors.text,
            }}
          />
        </View>

        {filtered.map((p, i) => {
          const prevInitial = i > 0 ? (filtered[i - 1].name[0] ?? '').toUpperCase() : null;
          const initial = (p.name[0] ?? '').toUpperCase();
          const showLetter = initial !== prevInitial;
          const count = phraseCounts[p.id] ?? 0;
          const short = langShort(p.lang);
          const last = dayMonthLabel(p.last_mention_at);
          const hint = personHint(p, duplicates.has(p.name.trim().toLowerCase()));
          return (
            <View key={p.id}>
              {showLetter && (
                <Text style={[text.monoFieldLabel, { paddingTop: 10, paddingBottom: 4 }]}>— {initial}</Text>
              )}
              <Pressable
                onPress={() => navigation.navigate('PersonDetail', { id: p.id })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 11,
                  borderTopWidth: 1,
                  borderTopColor: colors.rule,
                  opacity: pressed ? 0.6 : 1,
                })}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[text.body]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {!!hint && (
                    <Text style={[text.monoMicro, { fontSize: 10.5, textTransform: 'none', marginTop: 2 }]} numberOfLines={1}>
                      {hint}
                    </Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  {short && (
                    <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.accent, letterSpacing: 0.8 }}>
                      {short}
                      {count > 0 ? ` · ${count}` : ''}
                    </Text>
                  )}
                  {!!last && (
                    <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.mutedSoft }}>{last}</Text>
                  )}
                </View>
              </Pressable>
            </View>
          );
        })}

        {filtered.length === 0 && (
          <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 28, textAlign: 'center' }]}>
            {people.length === 0 ? 'MENTION SOMEONE WITH @ TO ADD THEM' : 'NO MATCHES'}
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
