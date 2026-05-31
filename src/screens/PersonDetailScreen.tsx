// /people/:id — PersonDetail (notebook-people.jsx → PeopleDetail). [name] kicker, big
// name + language badge + context; PHRASES tagged to them (read-only in P2; play + the
// "+ phrase for [name]" create arrive in P3); IN THE JOURNAL — entries mentioning them
// → /entry/:id. The ⋯ menu offers "Edit details" → /people/new in edit mode.

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { colors, radius, fonts, tracking } from '../theme/tokens';
import { text } from '../theme/typography';
import { rowDate } from '../lib/format';
import { langShort, langName } from '../lib/lang';
import { getPerson, personOrdinal } from '../data/people';
import { listPhrasesForPerson } from '../data/phrases';
import { entriesMentioning, type ParsedEntry } from '../data/entries';
import { resolveRefs, type ResolvedRefs } from '../data/resolve';
import { SnippetText } from '../components/BodyText';
import type { PersonRow, PhraseRow } from '../db/schema';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonDetail'>;

export function PersonDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [person, setPerson] = useState<PersonRow | null>(null);
  const [ordinal, setOrdinal] = useState(1);
  const [phrases, setPhrases] = useState<PhraseRow[]>([]);
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [refs, setRefs] = useState<ResolvedRefs>({ people: {}, phrases: {} });
  const [menuOpen, setMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const p = await getPerson(id);
        if (!alive) return;
        if (!p) {
          setPerson(null);
          return;
        }
        const [ord, phr, ent] = await Promise.all([
          personOrdinal(id),
          listPhrasesForPerson(id),
          entriesMentioning(id),
        ]);
        if (!alive) return;
        setPerson(p);
        setOrdinal(ord);
        setPhrases(phr);
        setEntries(ent);
        setRefs(await resolveRefs(ent.map((e) => e.nodes)));
      })();
      return () => {
        alive = false;
      };
    }, [id]),
  );

  const short = langShort(person?.lang);
  const name = langName(person?.lang);

  return (
    <Screen>
      <ScreenHeader
        title={`PERSON · ${String(ordinal).padStart(3, '0')}`}
        leading="back"
        onLeading={() => navigation.goBack()}
        trailing={<Icon name="more" size={18} color={colors.muted} />}
        onTrailing={() => setMenuOpen(true)}
      />

      {person && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {/* identity */}
          <Text style={[text.monoFieldLabel, { color: colors.accent }]}>[{person.name.toLowerCase()}]</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 4 }}>
            <Text style={[text.hero, { flex: 1 }]} numberOfLines={2}>
              {person.name}
            </Text>
            {short && (
              <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.accentSoft }}>
                <Text style={{ fontFamily: fonts.mono.medium, fontSize: 10, color: colors.accent, letterSpacing: tracking(10, 0.12) }}>
                  {short}
                  {name ? ` · ${name.toUpperCase()}` : ''}
                </Text>
              </View>
            )}
          </View>
          {!!person.context && (
            <Text style={{ fontFamily: fonts.mono.regular, fontSize: 11, color: colors.muted, marginTop: 6 }}>
              {person.context}
            </Text>
          )}

          {/* phrases */}
          <SectionLabel label="PHRASES" trailing={phrases.length > 0 ? `${phrases.length}${short ? ` · ${short}` : ''}` : undefined} />
          {phrases.length === 0 ? (
            <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, paddingVertical: 10, textTransform: 'none' }]}>
              No phrases yet — adding phrases for {person.name} arrives in the next phase.
            </Text>
          ) : (
            phrases.map((ph) => (
              <View
                key={ph.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.ruleSoft,
                }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[text.body, { fontSize: 13 }]} numberOfLines={1}>
                    {ph.en}
                  </Text>
                  {!!ph.tgt && (
                    <Text style={{ fontFamily: fonts.mono.regular, fontSize: 11, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                      {ph.tgt}
                    </Text>
                  )}
                </View>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: colors.rule,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name="play" size={8} color={colors.textSoft} />
                </View>
              </View>
            ))
          )}

          {/* in the journal */}
          <SectionLabel label="IN THE JOURNAL" trailing={`${entries.length} ${entries.length === 1 ? 'ENTRY' : 'ENTRIES'}`} />
          {entries.length === 0 ? (
            <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, paddingVertical: 10, textTransform: 'none' }]}>
              {person.name} hasn’t appeared in an entry yet.
            </Text>
          ) : (
            entries.map((e) => {
              const rd = rowDate(e.date);
              return (
                <Pressable
                  key={e.id}
                  onPress={() => navigation.navigate('Entry', { id: e.id })}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    gap: 12,
                    paddingVertical: 10,
                    borderTopWidth: 1,
                    borderTopColor: colors.ruleSoft,
                    opacity: pressed ? 0.6 : 1,
                  })}>
                  <View style={{ width: 48, paddingTop: 2 }}>
                    <Text style={[text.monoMicro, { fontSize: 10, color: colors.muted, textTransform: 'none' }]}>
                      {rd.day} {rd.mon}
                    </Text>
                    <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft }]}>{rd.wd}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <SnippetText
                      nodes={e.nodes}
                      people={refs.people}
                      numberOfLines={2}
                      style={{ fontSize: 12.5, color: colors.textSoft }}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ⋯ menu */}
      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <Pressable
          onPress={() => {
            setMenuOpen(false);
            navigation.navigate('PersonNew', { id });
          }}
          style={{ paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.ruleSoft }}>
          <Text style={[text.body]}>Edit details</Text>
          <Text style={[text.monoMicro, { fontSize: 10, marginTop: 2, textTransform: 'none' }]}>name & context</Text>
        </Pressable>
        <Pressable onPress={() => setMenuOpen(false)} style={{ paddingHorizontal: 16, paddingVertical: 15 }}>
          <Text style={[text.monoButton, { fontSize: 11, color: colors.muted }]}>CANCEL</Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}

function SectionLabel({ label, trailing }: { label: string; trailing?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 22,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.rule,
      }}>
      <Text style={[text.monoFieldLabel]}>{label}</Text>
      {!!trailing && <Text style={[text.monoMicro, { fontSize: 10 }]}>{trailing}</Text>}
    </View>
  );
}
