// /entry/:id — committed entry read view (§4). Inline [name] refs + phrase cards
// render from the DB; EDIT → /write in edit mode. back ‹ returns to caller.
//
// Phase 1: EDIT is gated to text-only entries (the plain-text editor can't yet
// represent person/phrase nodes — rich editing arrives with the pickers).

import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { BodyText } from '../components/BodyText';
import { colors } from '../theme/tokens';
import { text } from '../theme/typography';
import { composeStamp, timeFromIso } from '../lib/format';
import { hasRichNodes, mentionIds, phraseIds } from '../data/body';
import { getEntry, entryOrdinal, type ParsedEntry } from '../data/entries';
import { resolveRefs, type ResolvedRefs } from '../data/resolve';

type Props = NativeStackScreenProps<RootStackParamList, 'Entry'>;

export function EntryScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [entry, setEntry] = useState<ParsedEntry | null>(null);
  const [refs, setRefs] = useState<ResolvedRefs>({ people: {}, phrases: {} });
  const [ordinal, setOrdinal] = useState(1);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const e = await getEntry(id);
        if (!alive || !e) return;
        setEntry(e);
        setOrdinal(await entryOrdinal(id));
        setRefs(await resolveRefs([e.nodes]));
      })();
      return () => {
        alive = false;
      };
    }, [id]),
  );

  const onEdit = () => {
    if (!entry) return;
    if (hasRichNodes(entry.nodes)) {
      Alert.alert('Coming soon', 'Editing entries that contain people or phrases arrives in a later phase.');
      return;
    }
    navigation.navigate('Compose', { entryId: id });
  };

  const title = `ENTRY · ${String(ordinal).padStart(3, '0')}`;
  const nMentions = entry ? new Set(mentionIds(entry.nodes)).size : 0;
  const nPhrases = entry ? new Set(phraseIds(entry.nodes)).size : 0;

  return (
    <Screen>
      <ScreenHeader
        title={title}
        leading="back"
        onLeading={() => navigation.goBack()}
        trailing={<Text style={[text.monoMicro, { fontSize: 10 }]}>EDIT</Text>}
        onTrailing={onEdit}
      />
      {entry && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Text style={[text.monoLabel, { color: colors.accent, fontSize: 11 }]}>
            {composeStamp(entry.date, timeFromIso(entry.created_at))}
          </Text>

          <View style={{ marginTop: 18 }}>
            <BodyText nodes={entry.nodes} people={refs.people} phrases={refs.phrases} />
          </View>

          {(nMentions > 0 || nPhrases > 0) && (
            <View
              style={{
                marginTop: 22,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: colors.rule,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}>
              <Text style={[text.monoMicro, { fontSize: 10 }]}>
                LINKED · {nMentions} {nMentions === 1 ? 'PERSON' : 'PEOPLE'} · {nPhrases} PHRASE
              </Text>
              <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft }]}>OPEN ↗</Text>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
