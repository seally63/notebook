// The compose `@` people picker (notebook-compose.jsx → picker sheet, mention mode).
// An inset card floating just above the writing toolbar, filtered live by the `@query`
// the user is typing in the editor. NOT a RN Modal — a Modal would blur the editor's
// TextInput and drop the keyboard; this is an absolute overlay so the field keeps focus.
//
// Rows: matching people (avatar initial · name · context · lang), plus a "＋ New person"
// create row at the top when the query doesn't exactly match an existing name (§5 —
// creates the person inline and inserts the [name], no navigation).

import React, { useMemo } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import type { PersonRow } from '../db/schema';
import { colors, radius, fonts, shadows } from '../theme/tokens';
import { text } from '../theme/typography';
import { langShort } from '../lib/lang';
import { personHint, duplicateNameSet } from '../lib/personHint';

const matches = (p: PersonRow, q: string): boolean => {
  if (!q) return true;
  const needle = q.toLowerCase();
  return p.name.toLowerCase().includes(needle) || (p.context ?? '').toLowerCase().includes(needle);
};

export function MentionPicker({
  visible,
  query,
  people,
  bottom,
  onSelect,
  onCreate,
}: {
  visible: boolean;
  query: string;
  people: PersonRow[];
  bottom: number;
  onSelect: (person: PersonRow) => void;
  onCreate: (name: string) => void;
}) {
  const q = query.trim();
  const filtered = useMemo(() => people.filter((p) => matches(p, q)), [people, q]);
  const duplicates = useMemo(() => duplicateNameSet(filtered), [filtered]);
  // Notebook is about real people in your life, so same-named people are normal (two
  // Chloes, two Dads). Always offer create when typing — even on an exact name match —
  // and clarify the row when it would make a separate person with an existing name.
  const exact = useMemo(() => people.some((p) => p.name.toLowerCase() === q.toLowerCase()), [people, q]);
  const showCreate = q.length > 0;

  if (!visible) return null;

  const createRow = (
    <Pressable
      key="create"
      onPress={() => onCreate(q)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderTopWidth: exact ? 1 : 0,
        borderTopColor: colors.ruleSoft,
        borderBottomWidth: exact ? 0 : 1,
        borderBottomColor: colors.ruleSoft,
        backgroundColor: pressed ? colors.selected : 'transparent',
      })}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ fontFamily: fonts.mono.regular, fontSize: 15, color: colors.accent, lineHeight: 18 }}>+</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[text.body, { fontSize: 13.5 }]} numberOfLines={1}>
          {exact ? 'Another ' : 'New person · '}
          <Text style={{ fontFamily: fonts.mono.regular, color: colors.accent }}>[{q.toLowerCase()}]</Text>
        </Text>
        <Text style={[text.monoMicro, { fontSize: 10, textTransform: 'none' }]}>
          {exact ? 'a separate person with the same name' : 'creates them & tags this entry'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <View
      style={[
        {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom,
          maxHeight: 320,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.rule,
          borderRadius: radius.md,
          overflow: 'hidden',
        },
        shadows.sheet,
      ]}>
      {/* header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 11,
          borderBottomWidth: 1,
          borderBottomColor: colors.rule,
        }}>
        <Text style={[text.monoLabel, { fontSize: 10 }]}>
          <Text style={{ color: colors.accent }}>@ </Text>MENTION SOMEONE
        </Text>
        <Text style={[text.monoMicro, { fontSize: 10, textTransform: 'none' }]}>
          {q ? <Text style={{ color: colors.accent }}>{q}</Text> : <Text style={{ color: colors.mutedSoft }}>type to filter</Text>}
        </Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="always" style={{ flexGrow: 0 }}>
        {/* new/unknown name → create row on top (matches the mock §5) */}
        {showCreate && !exact && createRow}

        {filtered.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onSelect(p)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 14,
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderBottomColor: colors.ruleSoft,
              backgroundColor: pressed ? colors.selected : 'transparent',
            })}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.rule,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Text style={{ fontFamily: fonts.mono.regular, fontSize: 11, color: colors.text }}>
                {p.initial ?? p.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[text.body, { fontSize: 13.5 }]} numberOfLines={1}>
                {p.name}
              </Text>
              {(() => {
                const hint = personHint(p, duplicates.has(p.name.trim().toLowerCase()));
                return hint ? (
                  <Text style={[text.monoMicro, { fontSize: 10, textTransform: 'none' }]} numberOfLines={1}>
                    {hint}
                  </Text>
                ) : null;
              })()}
            </View>
            <Text style={{ fontFamily: fonts.mono.regular, fontSize: 9.5, color: p.lang ? colors.accent : colors.mutedSoft }}>
              {langShort(p.lang) ?? 'EN'}
            </Text>
          </Pressable>
        ))}

        {/* exact existing name → create-a-separate-person row at the BOTTOM, so the
            existing match is the prominent target (no delete-person UI yet in P2). */}
        {showCreate && exact && createRow}

        {!showCreate && filtered.length === 0 && (
          <Text style={[text.monoMicro, { fontSize: 10, padding: 16, textAlign: 'center' }]}>
            NO PEOPLE YET — TYPE A NAME TO ADD ONE
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
