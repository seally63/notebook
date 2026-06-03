// Search (`/search`) — the universal entry point + browse hub (dock·SEARCH). One query
// field filters across people / entries / phrases live; the OR BROWSE chips are the
// durable doors into the People and Phrases libraries (which have no dock tab). Results
// group by kind and route to the matching detail screen.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { useDockLayout } from '../components/dockLayout';
import { colors, radius, fonts, tracking } from '../theme/tokens';
import { text } from '../theme/typography';
import { rowDate } from '../lib/format';
import { langShort } from '../lib/lang';
import { searchAll, type SearchResults } from '../data/search';

const EMPTY: SearchResults = { people: [], entries: [], phrases: [], counts: { entries: 0, people: 0, phrases: 0 } };

export function SearchScreen() {
  const { clearance } = useDockLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [query, setQuery] = useState('');
  const [res, setRes] = useState<SearchResults>(EMPTY);
  const seq = useRef(0);

  // load library counts on mount (for the BROWSE chips even with no query)
  useEffect(() => {
    searchAll('').then(setRes);
  }, []);

  const onChange = useCallback((q: string) => {
    setQuery(q);
    const mine = ++seq.current;
    searchAll(q).then((r) => {
      if (mine === seq.current) setRes(r);
    });
  }, []);

  const q = query.trim();
  const hasQuery = q.length > 0;
  const nothing = hasQuery && res.people.length === 0 && res.entries.length === 0 && res.phrases.length === 0;

  return (
    <Screen padTop>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: clearance }} keyboardShouldPersistTaps="handled">
        {/* header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: colors.rule,
          }}>
          <Text style={[text.monoLabel, { color: colors.text }]}>NOTEBOOK · SEARCH</Text>
          <Text style={[text.monoLabel]}>EVERYTHING</Text>
        </View>

        {/* query field */}
        <View
          style={{
            marginTop: 14,
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: hasQuery ? colors.text : colors.rule,
            borderRadius: radius.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}>
          <Icon name="search" size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={onChange}
            placeholder="SEARCH ENTRIES, PEOPLE, PHRASES…"
            placeholderTextColor={colors.mutedSoft}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={colors.accent}
            style={{ flex: 1, padding: 0, fontFamily: fonts.body.regular, fontSize: 14, color: colors.text }}
          />
        </View>

        {/* browse hub */}
        <Text style={{ marginTop: 14, marginBottom: 6, fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.mutedSoft, letterSpacing: 1 }}>
          OR BROWSE
        </Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <BrowseChip label="ENTRIES" n={res.counts.entries} onPress={() => navigation.navigate('Home', { screen: 'Write' })} />
          <BrowseChip label="PEOPLE" n={res.counts.people} onPress={() => navigation.navigate('People')} />
          <BrowseChip label="PHRASES" n={res.counts.phrases} onPress={() => navigation.navigate('Phrases')} />
        </View>

        {/* results */}
        {res.people.length > 0 && (
          <>
            <GroupLabel label="PEOPLE" n={res.people.length} />
            {res.people.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => navigation.navigate('PersonDetail', { id: p.id })}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.ruleSoft, opacity: pressed ? 0.6 : 1 })}>
                <Avatar initial={p.initial ?? p.name.charAt(0).toUpperCase()} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Hl style={[text.body, { fontSize: 13.5 }]} value={p.name} q={q} />
                  <Text style={[text.monoMicro, { fontSize: 10, textTransform: 'none' }]} numberOfLines={1}>
                    {p.context || 'no context yet'}
                  </Text>
                </View>
                <Icon name="chev" size={13} color={colors.mutedSoft} />
              </Pressable>
            ))}
          </>
        )}

        {res.entries.length > 0 && (
          <>
            <GroupLabel label="ENTRIES" n={res.entries.length} />
            {res.entries.map(({ entry, preview }) => {
              const rd = rowDate(entry.date);
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => navigation.navigate('Entry', { id: entry.id })}
                  style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.ruleSoft, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ width: 46, paddingTop: 1 }}>
                    <Text style={[text.monoMicro, { fontSize: 10, color: colors.muted, textTransform: 'none' }]}>
                      {rd.day} {rd.mon}
                    </Text>
                    <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft }]}>{rd.wd}</Text>
                  </View>
                  <Hl style={[text.body, { flex: 1, fontSize: 12.5, color: colors.textSoft, lineHeight: 18 }]} value={preview} q={q} numberOfLines={2} />
                  <Icon name="chev" size={13} color={colors.mutedSoft} />
                </Pressable>
              );
            })}
          </>
        )}

        {res.phrases.length > 0 && (
          <>
            <GroupLabel label="PHRASES" n={res.phrases.length} />
            {res.phrases.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => navigation.navigate('Phrases', p.for_person ? { personId: p.for_person } : undefined)}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.ruleSoft, opacity: pressed ? 0.6 : 1 })}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Hl style={[text.body, { fontSize: 13 }]} value={p.en} q={q} />
                  <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10.5, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                    {p.pending_translation && !p.tgt ? 'translating…' : p.tgt ?? '—'}
                  </Text>
                </View>
                <Text style={{ fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.accent }}>{langShort(p.lang) ?? ''}</Text>
              </Pressable>
            ))}
          </>
        )}

        {nothing && (
          <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 28, textAlign: 'center', textTransform: 'none' }]}>
            no matches for “{q}”.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function BrowseChip({ label, n, onPress }: { label: string; n: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.rule,
        borderRadius: radius.sm,
        backgroundColor: pressed ? colors.selected : colors.surface,
      })}>
      <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.text, letterSpacing: 0.8 }}>{label}</Text>
      <Text style={{ fontFamily: fonts.mono.regular, fontSize: 11, color: colors.accent, marginTop: 2 }}>{String(n).padStart(2, '0')}</Text>
    </Pressable>
  );
}

function GroupLabel({ label, n }: { label: string; n: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
      <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.text, letterSpacing: tracking(10, 0.14) }}>{label}</Text>
      <Text style={[text.monoMicro, { fontSize: 10 }]}>
        {String(n).padStart(2, '0')} {n === 1 ? 'MATCH' : 'MATCHES'}
      </Text>
    </View>
  );
}

function Avatar({ initial }: { initial: string }) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.rule, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.mono.regular, fontSize: 11, color: colors.text }}>{initial}</Text>
    </View>
  );
}

/** highlight the matched run(s) of `q` inside `value`. */
function Hl({ value, q, style, numberOfLines }: { value: string; q: string; style?: any; numberOfLines?: number }) {
  if (!q) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {value}
      </Text>
    );
  }
  const lower = value.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < value.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push(<Text key={k++}>{value.slice(i)}</Text>);
      break;
    }
    if (idx > i) parts.push(<Text key={k++}>{value.slice(i, idx)}</Text>);
    parts.push(
      <Text key={k++} style={{ color: colors.accent, backgroundColor: colors.accentSoft }}>
        {value.slice(idx, idx + needle.length)}
      </Text>,
    );
    i = idx + needle.length;
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts}
    </Text>
  );
}
