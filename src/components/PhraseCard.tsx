// Structured phrase card as it reads inside an entry (notebook-journal.jsx /
// notebook-compose.jsx). Header: "PHRASE · <lang> · TAGGED [name]" + ▶; then the
// English and the target. ▶ is ALWAYS inline audio (Phase 3); inert in Phase 1.
// A stub variant (accent border, "— add translation", FINISH ↗) supports the §5
// round-trip in Phase 3.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { PhraseRow } from '../db/schema';
import { Icon } from './Icon';
import { colors, radius, fonts, tracking } from '../theme/tokens';
import { text } from '../theme/typography';

function CardShell({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <View
      style={{
        marginVertical: 10,
        padding: 13,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: accent ? colors.accent : colors.rule,
        borderRadius: radius.sm,
      }}>
      {children}
    </View>
  );
}

function HeaderRow({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
      <Text style={[text.monoMicro, { fontSize: 9.5 }]}>{left}</Text>
      {right}
    </View>
  );
}

export function PhraseCard({
  phrase,
  taggedName,
  onPlay,
}: {
  phrase: PhraseRow;
  taggedName?: string;
  onPlay?: () => void;
}) {
  const langLabel = (phrase.lang ?? '··').toUpperCase();
  return (
    <CardShell>
      <HeaderRow
        left={
          <>
            <Text style={{ color: colors.accent }}>PHRASE</Text>
            <Text>{` · ${langLabel}${taggedName ? ` · TAGGED [${taggedName.toLowerCase()}]` : ''}`}</Text>
          </>
        }
        right={
          <Pressable onPress={onPlay} hitSlop={10} disabled={!onPlay} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Icon name="play" size={11} color={colors.text} />
          </Pressable>
        }
      />
      <Text style={[text.lead, { fontSize: 15, letterSpacing: tracking(15, -0.02) }]}>{phrase.en}</Text>
      {!!phrase.tgt && (
        <Text style={{ fontFamily: fonts.mono.regular, fontSize: 12, color: colors.muted, marginTop: 5 }}>{phrase.tgt}</Text>
      )}
    </CardShell>
  );
}

export function PhraseStubCard({ en, onFinish }: { en: string; onFinish?: () => void }) {
  return (
    <CardShell accent>
      <HeaderRow
        left={
          <>
            <Text style={{ color: colors.accent }}>PHRASE</Text>
            <Text> · ··</Text>
          </>
        }
        right={
          <Pressable onPress={onFinish} hitSlop={10}>
            <Text style={[text.monoMicro, { fontSize: 9.5, color: colors.accent }]}>FINISH ↗</Text>
          </Pressable>
        }
      />
      <Text style={[text.lead, { fontSize: 14.5 }]}>{en}</Text>
      <Text style={{ fontFamily: fonts.mono.regular, fontSize: 11.5, color: colors.mutedSoft, marginTop: 4 }}>
        — add translation
      </Text>
    </CardShell>
  );
}
