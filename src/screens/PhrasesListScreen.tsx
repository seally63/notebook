// /phrases — PhrasesList. Phrases grouped by tagged person (FOR [name] · LANG), then a
// GENERAL group for untagged. Filters: a LANGUAGE chip row (only langs actually in use) +
// a text box (English / translation / person). ▶ plays inline; + NEW → /phrases/new;
// tap a row → practice; LONG-PRESS → delete. Optional personId param pins one person.

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { PlayButton } from '../components/PlayButton';
import { FilterChips, type ChipOption } from '../components/FilterChips';
import { Icon } from '../components/Icon';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { langShort, LANGUAGES } from '../lib/lang';
import { listPhrases, deletePhrase } from '../data/phrases';
import { listPeople } from '../data/people';
import type { PhraseRow, PersonRow } from '../db/schema';

type Props = NativeStackScreenProps<RootStackParamList, 'Phrases'>;

interface Group {
  key: string;
  label: string;
  personId: string | null;
  lang: string | null;
  items: PhraseRow[];
}

/** leading 2-letter subtag, lowercased — the language key shared by 'pl-PL' and 'PL'. */
const langKey = (lang: string | null | undefined): string => (lang ?? '').slice(0, 2).toLowerCase();

export function PhrasesListScreen({ route, navigation }: Props) {
  const filterPerson = route.params?.personId ?? null;
  const [phrases, setPhrases] = useState<PhraseRow[]>([]);
  const [people, setPeople] = useState<Record<string, PersonRow>>({});
  const [langFilter, setLangFilter] = useState('all'); // 'all' | 2-letter key
  const [query, setQuery] = useState('');

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
    Alert.alert('Delete this phrase?', `“${p.en}” will be removed from your library.`, [
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

  // language chips — only the languages actually present, in canonical order, with counts
  const langChips = useMemo<ChipOption[]>(() => {
    const counts = new Map<string, number>();
    for (const p of phrases) if (p.lang) counts.set(langKey(p.lang), (counts.get(langKey(p.lang)) ?? 0) + 1);
    const chips: ChipOption[] = [{ key: 'all', label: 'ALL', count: phrases.length }];
    for (const l of LANGUAGES) {
      const k = l.code.slice(0, 2).toLowerCase();
      if (counts.has(k)) chips.push({ key: k, label: l.short, count: counts.get(k) });
    }
    return chips;
  }, [phrases]);

  // apply language + text filters
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return phrases.filter((p) => {
      if (langFilter !== 'all' && langKey(p.lang) !== langFilter) return false;
      if (!q) return true;
      const person = p.for_person ? people[p.for_person]?.name ?? '' : '';
      return (
        p.en.toLowerCase().includes(q) ||
        (p.tgt ?? '').toLowerCase().includes(q) ||
        (p.tgt_romanised ?? '').toLowerCase().includes(q) ||
        person.toLowerCase().includes(q)
      );
    });
  }, [phrases, people, langFilter, query]);

  const groups = useMemo<Group[]>(() => {
    const byPerson = new Map<string, PhraseRow[]>();
    const general: PhraseRow[] = [];
    for (const p of filtered) {
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
      out.push({ key: pid, label: person?.name ?? '…', personId: pid, lang: items[0]?.lang ?? person?.lang ?? null, items });
    }
    out.sort((a, b) => a.label.localeCompare(b.label));
    if (general.length) out.push({ key: 'general', label: 'GENERAL', personId: null, lang: general[0]?.lang ?? null, items: general });
    return out;
  }, [filtered, people]);

  const title = `PHRASES · ${String(phrases.length).padStart(2, '0')}`;
  const hasFilter = langFilter !== 'all' || query.trim().length > 0;

  return (
    <Screen>
      <ScreenHeader
        title={title}
        leading="back"
        onLeading={() => navigation.goBack()}
        trailing={<Text style={[text.monoButton, { fontSize: 11, color: colors.accent }]}>+ NEW</Text>}
        onTrailing={() => navigation.navigate('PhraseNew', filterPerson ? { personId: filterPerson } : undefined)}
      />

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {/* search box */}
        <View
          style={{
            marginTop: 4,
            marginBottom: 8,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: query ? colors.text : colors.rule,
            borderRadius: radius.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}>
          <Icon name="search" size={14} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="FILTER PHRASE, TRANSLATION, PERSON…"
            placeholderTextColor={colors.mutedSoft}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, padding: 0, fontFamily: fonts.mono.regular, fontSize: 11, letterSpacing: 0.4, color: colors.text }}
          />
        </View>

        {/* language chips (only when there's more than one language in use) */}
        {langChips.length > 2 && (
          <View style={{ marginBottom: 8 }}>
            <FilterChips options={langChips} active={langFilter} onChange={setLangFilter} />
          </View>
        )}

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
                  <Text style={{ fontFamily: fonts.mono.regular, fontSize: 11, color: colors.muted, marginTop: 3 }} numberOfLines={1}>
                    {p.pending_translation ? 'translating…' : p.tgt ?? '—'}
                  </Text>
                </View>
                <PlayButton audioRef={p.audio_ref} pending={!!p.pending_audio && !p.audio_ref} size="md" />
              </Pressable>
            ))}
          </View>
        ))}

        {phrases.length === 0 ? (
          <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 28, textAlign: 'center' }]}>
            NO PHRASES YET — TAP + NEW, OR USE # WHILE WRITING
          </Text>
        ) : (
          groups.length === 0 &&
          hasFilter && (
            <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 28, textAlign: 'center', textTransform: 'none' }]}>
              no phrases match this filter.
            </Text>
          )
        )}
      </ScrollView>
    </Screen>
  );
}
