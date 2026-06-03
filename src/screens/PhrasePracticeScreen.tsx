// /phrases/practise — PhrasesPractice. A flip-card session: the English shows; REVEAL
// flips to the target + plays audio; NEXT / SHUFFLE advance. Modal (close-X). Optional
// personId filters the deck to one person. Phrases still pending translation are skipped.

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { colors, radius, fonts, tracking } from '../theme/tokens';
import { text } from '../theme/typography';
import { langShort } from '../lib/lang';
import { listPhrases, listPhrasesForPerson } from '../data/phrases';
import { getPerson } from '../data/people';
import { playAudio, stopAudio } from '../services/player';
import type { PhraseRow } from '../db/schema';

type Props = NativeStackScreenProps<RootStackParamList, 'PhrasePractice'>;

export function PhrasePracticeScreen({ route, navigation }: Props) {
  const personId = route.params?.personId ?? null;
  const insets = useSafeAreaInsets();
  const [deck, setDeck] = useState<PhraseRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [personName, setPersonName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const all = personId ? await listPhrasesForPerson(personId) : await listPhrases();
        const usable = all.filter((p) => p.tgt && !p.pending_translation);
        if (!alive) return;
        setDeck(usable);
        setIdx(0);
        setRevealed(false);
        if (personId) {
          const p = await getPerson(personId);
          if (alive) setPersonName(p?.name ?? null);
        }
      })();
      return () => {
        alive = false;
        stopAudio();
      };
    }, [personId]),
  );

  const card = deck[idx];
  const total = deck.length;
  const progress = total ? (idx + (revealed ? 1 : 0.5)) / total : 0;

  const reveal = () => {
    setRevealed(true);
    if (card?.audio_ref) playAudio(card.audio_ref);
  };

  const next = () => {
    stopAudio();
    setRevealed(false);
    setIdx((i) => (i + 1) % Math.max(total, 1));
  };

  const shuffle = () => {
    stopAudio();
    setRevealed(false);
    setIdx(() => (total ? Math.floor(((idx + 1) * 7 + 3) % total) : 0)); // deterministic-ish jump (no Math.random in this env)
  };

  const langTag = langShort(card?.lang);

  return (
    <Screen padTop>
      {/* close · NN / NN · LANG */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          height: 44,
        }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Close">
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
        <Text style={[text.monoLabel, { fontSize: 10 }]}>
          {total ? `${String(idx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : '—'}
          {langTag ? ` · ${langTag}` : ''}
        </Text>
        <View style={{ width: 18 }} />
      </View>

      {/* progress */}
      <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
        <View style={{ height: 2, backgroundColor: colors.rule }}>
          <View style={{ height: 2, width: `${Math.min(100, progress * 100)}%`, backgroundColor: colors.accent }} />
        </View>
      </View>

      {total === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, textAlign: 'center', lineHeight: 16 }]}>
            {personName ? `NO PRACTISABLE PHRASES FOR ${personName.toUpperCase()} YET.` : 'NO PHRASES READY TO PRACTISE YET.'}
            {'\n'}ADD ONE WITH + NEW.
          </Text>
        </View>
      ) : (
        <>
          {/* card */}
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <View
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.rule,
                borderRadius: radius.md,
                padding: 22,
                justifyContent: 'space-between',
              }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[text.monoMicro, { fontSize: 10 }]}>
                  <Text style={{ color: colors.accent }}>{revealed ? langTag ?? '··' : 'EN'}</Text>
                  {card?.for_person && personName ? ` · FOR [${personName.toLowerCase()}]` : ''}
                </Text>
                <Text style={[text.monoMicro, { fontSize: 10 }]}>
                  {String(idx + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}
                </Text>
              </View>

              <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
                <Text
                  style={{
                    fontFamily: revealed ? fonts.mono.regular : fonts.body.regular,
                    fontSize: revealed ? 22 : 24,
                    lineHeight: revealed ? 32 : 32,
                    color: colors.text,
                    textAlign: 'center',
                    letterSpacing: revealed ? 0 : tracking(24, -0.02),
                  }}>
                  {revealed ? card?.tgt : card?.en}
                </Text>
                {revealed && !!card?.tgt_romanised && (
                  <Text style={{ fontFamily: fonts.mono.regular, fontSize: 12, color: colors.muted, marginTop: 10, textAlign: 'center' }}>
                    {card.tgt_romanised}
                  </Text>
                )}
                {revealed && !!card?.note && (
                  <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 10, textTransform: 'none', textAlign: 'center' }]}>
                    {card.note}
                  </Text>
                )}
              </View>

              <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, textAlign: 'center' }]}>
                {revealed ? (card?.audio_ref ? 'TAP REVEAL AGAIN TO REPLAY' : 'NO AUDIO YET') : 'TAP REVEAL TO HEAR IT'}
              </Text>
            </View>
          </View>

          {/* reveal */}
          <View style={{ paddingHorizontal: 20 }}>
            <Pressable
              onPress={revealed ? () => card?.audio_ref && playAudio(card.audio_ref) : reveal}
              style={({ pressed }) => ({
                height: 50,
                borderRadius: radius.sm,
                backgroundColor: colors.text,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                opacity: pressed ? 0.85 : 1,
              })}>
              <Icon name="speaker" size={15} color={colors.surface} />
              <Text style={[text.monoButton, { fontSize: 11, color: colors.surface }]}>{revealed ? 'PLAY' : 'REVEAL'}</Text>
            </Pressable>
          </View>

          {/* shuffle / next */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: Math.max(insets.bottom, 12) + 8,
            }}>
            <Pressable onPress={shuffle} hitSlop={8}>
              <Text style={[text.monoLabel, { fontSize: 10 }]}>SHUFFLE</Text>
            </Pressable>
            <Pressable onPress={next} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[text.monoLabel, { fontSize: 10, color: colors.text }]}>NEXT</Text>
              <Icon name="chev" size={12} color={colors.text} />
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  );
}
