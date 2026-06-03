// The translation panel revealed when an inline «phrase» chip is tapped in a read view.
// Compact, sits right under the paragraph: target translation + romanisation (for
// Cyrillic) + a ▶ to play the audio. Shows "translating…" until the background pipeline
// fills it in (the parent re-reads the phrase, so this updates live).

import React from 'react';
import { View, Text } from 'react-native';
import type { PhraseRow, PhraseVariant } from '../db/schema';
import { PlayButton } from './PlayButton';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { langShort } from '../lib/lang';

function parseVariants(json: string | null | undefined): PhraseVariant[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/** one target line: native script + romanisation underneath. */
function Form({ tgt, romanised }: { tgt: string; romanised: string | null }) {
  return (
    <View>
      <Text style={{ fontFamily: fonts.mono.regular, fontSize: 14, color: colors.text }}>{tgt}</Text>
      {!!romanised && (
        <Text style={{ fontFamily: fonts.mono.regular, fontSize: 11.5, color: colors.muted, marginTop: 2 }}>
          {romanised}
        </Text>
      )}
    </View>
  );
}

export function PhraseReveal({ phrase, taggedName }: { phrase: PhraseRow; taggedName?: string }) {
  const lang = langShort(phrase.lang) ?? '··';
  const translating = !!phrase.pending_translation && !phrase.tgt;
  const variants = parseVariants(phrase.variants);
  const male = variants.find((v) => v.gender === 'male');
  const female = variants.find((v) => v.gender === 'female');
  const gendered = !!male && !!female;

  return (
    <View
      style={{
        marginTop: 8,
        marginBottom: 4,
        padding: 12,
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.rule,
      }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={[text.monoMicro, { fontSize: 9.5 }]}>
          <Text style={{ color: colors.accent }}>{lang}</Text>
          {gendered ? ' · BY SPEAKER' : ''}
          {taggedName ? ` · FOR [${taggedName.toLowerCase()}]` : ''}
        </Text>
        <PlayButton audioRef={phrase.audio_ref} pending={!!phrase.pending_audio && !phrase.audio_ref} />
      </View>

      {translating ? (
        <Text style={{ fontFamily: fonts.mono.regular, fontSize: 12, color: colors.mutedSoft }}>translating…</Text>
      ) : gendered ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={[text.monoMicro, { fontSize: 9.5, color: colors.accent, width: 64 }]}>♂ MALE</Text>
            <View style={{ flex: 1 }}>
              <Form tgt={male.tgt} romanised={male.romanised} />
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: colors.ruleSoft, marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={[text.monoMicro, { fontSize: 9.5, color: colors.accent, width: 64 }]}>♀ FEMALE</Text>
            <View style={{ flex: 1 }}>
              <Form tgt={female.tgt} romanised={female.romanised} />
            </View>
          </View>
        </>
      ) : (
        <Form tgt={phrase.tgt ?? '—'} romanised={phrase.tgt_romanised} />
      )}

      {!!phrase.note && !translating && (
        <Text style={[text.monoMicro, { fontSize: 9.5, color: colors.mutedSoft, marginTop: 8, textTransform: 'none' }]}>
          {phrase.note}
        </Text>
      )}
    </View>
  );
}
