// The compose `#` phrase picker (mirrors MentionPicker). An inset card above the toolbar,
// filtered live by the `#query` typed in the editor. Pick an existing phrase → it inserts
// as an inline «english» chip; "＋ NEW PHRASE" → a stub chip + the /phrases/new round-trip.

import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import type { PhraseRow, PersonRow } from '../db/schema';
import { Icon } from './Icon';
import { colors, radius, fonts, shadows } from '../theme/tokens';
import { text } from '../theme/typography';
import { langShort } from '../lib/lang';

export function PhrasePicker({
  visible,
  query,
  phrases,
  people,
  bottom,
  onSelect,
  onCreate,
  onClose,
}: {
  visible: boolean;
  query: string;
  phrases: PhraseRow[];
  people: Record<string, PersonRow>;
  bottom: number;
  onSelect: (phrase: PhraseRow) => void;
  onCreate: (prefillEn: string) => void;
  onClose: () => void;
}) {
  const q = query.trim().toLowerCase();
  // Suggest progressively, type-ahead style. A field "matches" when it STARTS WITH the
  // query — i.e. you're completing a phrase from its beginning ("I w…" → "I want to skip
  // rope"). A short query no longer matches interior letters ("I" won't pull in
  // "what is that" or "disciplined"). For multi-word queries we also allow a contained
  // exact run so "skip rope" still finds "I want to skip rope".
  const filtered = useMemo(() => {
    if (!q) return [];
    const startsWith = (s: string | null | undefined) => !!s && s.toLowerCase().startsWith(q);
    const contains = (s: string | null | undefined) => !!s && s.toLowerCase().includes(q);
    const multiWord = q.includes(' ');
    return phrases.filter((p) => {
      const person = p.for_person ? people[p.for_person]?.name : undefined;
      const fields = [p.en, p.tgt, p.tgt_romanised, person];
      if (fields.some(startsWith)) return true;
      // a multi-word query is specific enough to match anywhere inside the phrase
      return multiWord && fields.some(contains);
    });
  }, [phrases, people, q]);

  if (!visible) return null;

  return (
    <View style={[styles.card, { bottom }, shadows.sheet]}>
      <View style={styles.header}>
        <Text style={[text.monoLabel, { fontSize: 10 }]}>
          <Text style={{ color: colors.accent }}># </Text>ATTACH A PHRASE
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={[text.monoMicro, { fontSize: 10, textTransform: 'none' }]} numberOfLines={1}>
            {query ? <Text style={{ color: colors.accent }}>{query}</Text> : <Text style={{ color: colors.mutedSoft }}>type a phrase</Text>}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close phrase picker">
            <Icon name="close" size={14} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="always" style={{ flexGrow: 0 }}>
        <Pressable onPress={() => onCreate(query.trim())} style={({ pressed }) => [styles.createRow, pressed && { backgroundColor: colors.selected }]}>
          <View style={styles.plus}>
            <Text style={{ fontFamily: fonts.mono.regular, fontSize: 14, color: colors.accent, lineHeight: 16 }}>+</Text>
          </View>
          <Text style={[text.monoButton, { fontSize: 11, color: colors.accent }]}>NEW PHRASE</Text>
          {!!query.trim() && (
            <Text style={[text.body, { fontSize: 13, color: colors.text }]} numberOfLines={1}>
              “{query.trim()}”
            </Text>
          )}
          <View style={{ flex: 1 }} />
          <Icon name="arrowR" size={12} color={colors.muted} />
        </Pressable>

        {filtered.map((p) => {
          const tagged = p.for_person ? people[p.for_person]?.name : undefined;
          return (
            <Pressable key={p.id} onPress={() => onSelect(p)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.selected }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[text.body, { fontSize: 13 }]} numberOfLines={1}>
                  {p.en}
                </Text>
                <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10.5, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                  {tagged ? <Text style={{ color: colors.accent }}>[{tagged.toLowerCase()}] · </Text> : null}
                  {p.pending_translation && !p.tgt ? 'translating…' : p.tgt ?? '—'}
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.accent }}>{langShort(p.lang) ?? ''}</Text>
            </Pressable>
          );
        })}

        {q.length === 0 && (
          <Text style={[text.monoMicro, { fontSize: 10, padding: 16, textAlign: 'center', textTransform: 'none' }]}>
            type to find a saved phrase, or tap ＋ NEW PHRASE
          </Text>
        )}
        {q.length > 0 && filtered.length === 0 && (
          <Text style={[text.monoMicro, { fontSize: 10, padding: 16, textAlign: 'center' }]}>
            NO MATCHES — TAP ＋ NEW PHRASE
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 14,
    right: 14,
    maxHeight: 320,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleSoft,
  },
  plus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.ruleSoft,
  },
});
