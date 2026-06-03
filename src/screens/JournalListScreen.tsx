// JournalList (`/`) — the WRITE home (§4). NOTEBOOK header, the TODAY block (which
// resumes today's draft / opens today's entry / starts a new one — §8.4), then recent
// committed entries. Drafts never appear as rows (§8.1).

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { SnippetText } from '../components/BodyText';
import { Icon } from '../components/Icon';
import { useDockLayout } from '../components/dockLayout';
import { colors, radius } from '../theme/tokens';
import { text } from '../theme/typography';
import { todayDate } from '../lib/time';
import { monthYearLabel, todayStamp, rowDate, timeFromIso } from '../lib/format';
import { phraseIds } from '../data/body';
import { listEntries, getEntryForDate, type ParsedEntry } from '../data/entries';
import { getTodayDraft, type ParsedDraft } from '../data/drafts';
import { resolveRefs, type ResolvedRefs } from '../data/resolve';
import { langShort } from '../lib/lang';
import { playAudio } from '../services/player';
import type { PhraseRow } from '../db/schema';

export function JournalListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { clearance } = useDockLayout();

  const [todayEntry, setTodayEntry] = useState<ParsedEntry | null>(null);
  const [todayDraft, setTodayDraft] = useState<ParsedDraft | null>(null);
  const [past, setPast] = useState<ParsedEntry[]>([]);
  const [refs, setRefs] = useState<ResolvedRefs>({ people: {}, phrases: {} });

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const today = todayDate();
        const [te, td, all] = await Promise.all([getEntryForDate(today), getTodayDraft(), listEntries(60)]);
        if (!alive) return;
        const pastRows = all.filter((e) => e.date !== today);
        setTodayEntry(te ?? null);
        setTodayDraft(te ? null : td ?? null); // a committed entry takes precedence over a draft
        setPast(pastRows);
        const bodies = [te?.nodes, td?.nodes, ...pastRows.map((e) => e.nodes)].filter(Boolean) as ParsedEntry['nodes'][];
        setRefs(await resolveRefs(bodies));
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const firstPhrase = (nodes: ParsedEntry['nodes']): PhraseRow | undefined => {
    const ids = phraseIds(nodes);
    return ids.length ? refs.phrases[ids[0]] : undefined;
  };

  const openToday = () => {
    if (todayEntry) navigation.navigate('Entry', { id: todayEntry.id });
    else navigation.navigate('Compose');
  };

  const openPerson = (pid: string) => navigation.navigate('PersonDetail', { id: pid });

  const today = todayDate();
  const todayNodes = todayEntry?.nodes ?? todayDraft?.nodes ?? null;
  const todayPhrase = todayEntry ? firstPhrase(todayEntry.nodes) : undefined;

  return (
    <Screen padTop>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: clearance }}>
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
          <Text style={[text.monoLabel, { color: colors.text }]}>NOTEBOOK</Text>
          <Text style={[text.monoLabel]}>{monthYearLabel()}</Text>
        </View>

        {/* TODAY block */}
        <Pressable onPress={openToday} style={{ paddingVertical: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
            <Text style={[text.monoFieldLabel, { color: colors.accent }]}>
              {todayDraft ? 'TODAY · DRAFT — RESUME' : 'TODAY'}
            </Text>
            <Text style={[text.monoMicro, { fontSize: 10 }]}>
              {todayStamp(
                today,
                todayEntry ? timeFromIso(todayEntry.created_at) : todayDraft ? timeFromIso(todayDraft.saved_at ?? todayDraft.updated_at) : undefined,
              )}
            </Text>
          </View>

          {todayNodes ? (
            <SnippetText
              nodes={todayNodes}
              people={refs.people}
              phrases={refs.phrases}
              numberOfLines={4}
              style={{ color: colors.text }}
              onPersonPress={openPerson}
            />
          ) : (
            <Text style={[text.body, { color: colors.mutedSoft, lineHeight: 21 }]}>
              What happened today? Tap to write your first entry.
            </Text>
          )}

          {todayPhrase && (
            <View
              style={{
                marginTop: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderWidth: 1,
                borderColor: colors.rule,
                borderRadius: radius.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}>
              <View style={{ backgroundColor: colors.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 }}>
                <Text style={{ fontFamily: 'GeistMono-Regular', fontSize: 9, color: colors.surface, letterSpacing: 1 }}>
                  {langShort(todayPhrase.lang) ?? '··'}
                </Text>
              </View>
              <Text style={[text.monoMicro, { fontSize: 10.5, color: colors.textSoft, textTransform: 'none', flex: 1 }]} numberOfLines={1}>
                {todayPhrase.en}
              </Text>
              <Pressable onPress={() => playAudio(todayPhrase.audio_ref)} hitSlop={10} disabled={!todayPhrase.audio_ref}>
                <Icon name="play" size={10} color={todayPhrase.audio_ref ? colors.text : colors.mutedSoft} />
              </Pressable>
            </View>
          )}
        </Pressable>

        {/* past entries */}
        {past.map((e) => {
          const rd = rowDate(e.date);
          const ph = firstPhrase(e.nodes);
          return (
            <Pressable
              key={e.id}
              onPress={() => navigation.navigate('Entry', { id: e.id })}
              style={{
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 12,
                borderTopWidth: 1,
                borderTopColor: colors.rule,
              }}>
              <View style={{ width: 54, paddingTop: 2 }}>
                <Text style={[text.monoMicro, { fontSize: 10, color: colors.muted, textTransform: 'none' }]}>
                  {rd.day} {rd.mon}
                </Text>
                <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft }]}>{rd.wd}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <SnippetText
                  nodes={e.nodes}
                  people={refs.people}
                  phrases={refs.phrases}
                  numberOfLines={2}
                  style={{ fontSize: 13, color: colors.textSoft }}
                  onPersonPress={openPerson}
                />
                {ph && (
                  <Text style={[text.monoMicro, { fontSize: 10, marginTop: 6, textTransform: 'none' }]} numberOfLines={1}>
                    <Text style={{ color: colors.accent }}>[{(ph.lang ?? '··').toUpperCase()}]</Text> {ph.en}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}

        {past.length === 0 && !todayEntry && !todayDraft && (
          <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 24, textAlign: 'center' }]}>
            YOUR ENTRIES WILL GATHER HERE
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}
