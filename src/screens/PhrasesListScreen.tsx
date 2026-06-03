// /phrases — PhrasesList. Grouped by tagged person (FOR [name] · LANG), then a GENERAL
// group for untagged. ▶ plays inline (shared player); + NEW → /phrases/new; tapping a
// row body → practice started near it; LONG-PRESS a row → delete it. Optional personId
// param filters to one person. No dock — reached via Search / Settings·LIBRARY / inline.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { PlayButton } from '../components/PlayButton';
import { colors, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { langShort } from '../lib/lang';
import { listPhrases, deletePhrase } from '../data/phrases';
import { listPeople } from '../data/people';
import type { PhraseRow, PersonRow } from '../db/schema';

type Props = NativeStackScreenProps<RootStackParamList, 'Phrases'>;

interface Group {
  key: string;
  label: string; // person name or 'GENERAL'
  personId: string | null;
  lang: string | null;
  items: PhraseRow[];
}

export function PhrasesListScreen({ route, navigation }: Props) {
  const filterPerson = route.params?.personId ?? null;
  const [phrases, setPhrases] = useState<PhraseRow[]>([]);
  const [people, setPeople] = useState<Record<string, PersonRow>>({});

  const load = useCallback(async () => {
    const [ph, ppl] = await Promise.all([listPhrases(), listPeople()]);
    setPhrases(filterPerson ? ph.filter((p) => p.for_person === filterPerson) : ph);
    setPeople(Object.fromEntries(ppl.map((p) => [p.id, p])));
  }, [filterPerson]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (alive) await load();
      })();
      return () => {
        alive = false;
      };
    }, [load]),
  );

  const confirmDelete = (p: PhraseRow) => {
    Alert.alert(`Delete this phrase?`, `“${p.en}” will be removed from your library.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePhrase(p.id);
          await load();
        },
      },
    ]);
  };

  const groups = useMemo<Group[]>(() => {
    const byPerson = new Map<string, PhraseRow[]>();
    const general: PhraseRow[] = [];
    for (const p of phrases) {
      if (p.for_person) {
        const arr = byPerson.get(p.for_person) ?? [];
        arr.push(p);
        byPerson.set(p.for_person, arr);
      } else {
        general.push(p);
      }
    }
    const out: Group[] = [];
    for (const [pid, items] of byPerson) {
      const person = people[pid];
      out.push({
        key: pid,
        label: person?.name ?? '…',
        personId: pid,
        lang: items[0]?.lang ?? person?.lang ?? null,
        items,
      });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    if (general.length) out.push({ key: 'general', label: 'GENERAL', personId: null, lang: general[0]?.lang ?? null, items: general });
    return out;
  }, [phrases, people]);

  const title = `PHRASES · ${String(phrases.length).padStart(2, '0')}`;

  return (
    <Screen>
      <ScreenHeader
        title={title}
        leading="back"
        onLeading={() => navigation.goBack()}
        trailing={<Text style={[text.monoButton, { fontSize: 11, color: colors.accent }]}>+ NEW</Text>}
        onTrailing={() => navigation.navigate('PhraseNew', filterPerson ? { personId: filterPerson } : undefined)}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
        {groups.map((g, gi) => (
          <View key={g.key} style={{ marginTop: gi === 0 ? 4 : 18 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: 6,
                borderBottomWidth: 1,
                borderBottomColor: colors.rule,
              }}>
              <Text style={[text.monoFieldLabel, { color: colors.text }]}>
                {g.personId ? `FOR [${g.label.toLowerCase()}]` : 'GENERAL'}
              </Text>
              {!!langShort(g.lang) && (
                <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.accent, letterSpacing: 0.8 }}>
                  · {langShort(g.lang)}
                </Text>
              )}
            </View>

            {g.items.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => navigation.navigate('PhrasePractice', g.personId ? { personId: g.personId } : undefined)}
                onLongPress={() => confirmDelete(p)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.ruleSoft,
                  opacity: pressed ? 0.6 : 1,
                })}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[text.body, { fontSize: 13.5 }]} numberOfLines={1}>
                    {p.en}
                  </Text>
                  <Text
                    style={{ fontFamily: fonts.mono.regular, fontSize: 11, color: colors.muted, marginTop: 3 }}
                    numberOfLines={1}>
                    {p.pending_translation ? 'translating…' : p.tgt ?? '—'}
                  </Text>
                </View>
                <PlayButton audioRef={p.audio_ref} pending={!!p.pending_audio && !p.audio_ref} size="md" />
              </Pressable>
            ))}
          </View>
        ))}

        {phrases.length === 0 && (
          <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 28, textAlign: 'center' }]}>
            NO PHRASES YET — TAP + NEW, OR USE # WHILE WRITING
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
