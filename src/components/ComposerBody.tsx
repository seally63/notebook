// The shared mention-aware editor body — used by both the compose screen (new entry /
// resume draft) and the entry screen (edit-on-tap). It owns the single TextInput
// rendered with styled <Text> children so person tokens (`[name]`) appear as inline
// ACCENT CHIPS, plus caret tracking, the `@` trigger + people picker, and the writing
// toolbar. The parent owns the value (InputState), header/actions, autosave and commit.
//
// The hard reconciliation logic is pure + unit-tested in src/data/mentions.ts.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MentionPicker } from './MentionPicker';
import { colors, radius, fonts, tracking } from '../theme/tokens';
import { text } from '../theme/typography';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { type InputState, type Mention, reconcile, insertMention, findTrigger } from '../data/mentions';
import { listPeople, insertPerson } from '../data/people';
import type { PersonRow } from '../db/schema';

export interface ComposerBodyProps {
  value: InputState;
  onChange: (next: InputState) => void;
  autoFocus?: boolean;
  /** show the writing toolbar + enable the @ picker. Mounted only while actively
   *  editing; the read view is a separate read-only surface in the parent. */
  toolbarVisible?: boolean;
  onFocus?: () => void; // optional passthrough (TextInput focus)
  onRequestPhrase?: () => void; // # tapped
  placeholder?: string;
  /** rendered below the editor inside the scroll (coachmark / hints / linked footer) */
  children?: React.ReactNode;
}

export function ComposerBody({
  value,
  onChange,
  autoFocus,
  toolbarVisible = true,
  onFocus,
  onRequestPhrase,
  placeholder = 'What happened today?',
  children,
}: ComposerBodyProps) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [caret, setCaret] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const caretRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    listPeople().then(setPeople);
  }, []);

  const moveCaret = useCallback((pos: number) => {
    caretRef.current = pos;
    setCaret(pos);
    setPendingSelection({ start: pos, end: pos });
  }, []);

  // recompute the active @ trigger whenever text/caret/mentions change (off when inert)
  useEffect(() => {
    setTrigger(toolbarVisible ? findTrigger(value.text, caret, value.mentions) : null);
  }, [value, caret, toolbarVisible]);

  const onChangeText = (next: string) => {
    onChange(reconcile(valueRef.current.text, valueRef.current.mentions, next));
  };

  const onSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const s = e.nativeEvent.selection;
    caretRef.current = s.start;
    setCaret(s.start);
    if (pendingSelection) setPendingSelection(undefined); // forced caret applied
  };

  const openMentionFromToolbar = () => {
    const pos = caretRef.current;
    const t = valueRef.current.text;
    const needsSpace = pos > 0 && !/\s/.test(t[pos - 1]);
    const insert = (needsSpace ? ' ' : '') + '@';
    const newText = t.slice(0, pos) + insert + t.slice(pos);
    onChange(reconcile(t, valueRef.current.mentions, newText));
    moveCaret(pos + insert.length);
    inputRef.current?.focus();
  };

  const insertPersonAt = (person: PersonRow, triggerStart: number) => {
    const r = insertMention(valueRef.current, triggerStart, caretRef.current, person.id, person.name);
    onChange({ text: r.text, mentions: r.mentions });
    moveCaret(r.caret);
    setTrigger(null);
  };

  const pickPerson = (person: PersonRow) => {
    if (!trigger) return;
    insertPersonAt(person, trigger.start);
  };

  const createAndPick = async (name: string) => {
    const tr = trigger;
    const id = await insertPerson({ name });
    const all = await listPeople();
    setPeople(all);
    const person = all.find((p) => p.id === id);
    if (person && tr) insertPersonAt(person, tr.start);
  };

  const editorChildren = useMemo(() => buildChildren(value), [value]);
  const toolbarBottom = (kb > 0 ? kb : Math.max(insets.bottom, 12)) + 12;
  const pickerBottom = toolbarBottom + 58; // sit above the writing toolbar

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <TextInput
          ref={inputRef}
          autoFocus={autoFocus}
          multiline
          onChangeText={onChangeText}
          selection={pendingSelection}
          onSelectionChange={onSelectionChange}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedSoft}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          textAlignVertical="top"
          scrollEnabled={false}
          style={styles.input}>
          {editorChildren}
        </TextInput>
        {children}
      </ScrollView>

      {toolbarVisible && (
        <MentionPicker
          visible={!!trigger}
          query={trigger?.query ?? ''}
          people={people}
          bottom={pickerBottom}
          onSelect={pickPerson}
          onCreate={createAndPick}
        />
      )}

      {toolbarVisible && (
        <View style={[styles.toolbar, { bottom: toolbarBottom }]}>
          <ToolbarItem label="MENTION" sigil="@" active={!!trigger} onPress={openMentionFromToolbar} />
          <View style={styles.divider} />
          <ToolbarItem label="PHRASE" sigil="#" onPress={onRequestPhrase ?? (() => {})} />
          <View style={styles.divider} />
          <View style={styles.flexCenter}>
            <Text style={[text.monoMicro, { fontSize: 10 }]}>↵ NEW LINE</Text>
          </View>
        </View>
      )}
    </>
  );
}

/** Split (text, mentions) into styled <Text> runs: mentions render accent, mono. */
function buildChildren(state: InputState): React.ReactNode {
  const { text: t } = state;
  const mentions: Mention[] = [...state.mentions].sort((a, b) => a.start - b.start);
  if (mentions.length === 0) return t.length ? t : null;
  const out: React.ReactNode[] = [];
  let cur = 0;
  mentions.forEach((m, i) => {
    if (m.start > cur) out.push(<Text key={`t${i}`}>{t.slice(cur, m.start)}</Text>);
    out.push(
      <Text key={`m${i}`} style={styles.chip}>
        {t.slice(m.start, m.end)}
      </Text>,
    );
    cur = m.end;
  });
  if (cur < t.length) out.push(<Text key="tail">{t.slice(cur)}</Text>);
  return out;
}

function ToolbarItem({ label, sigil, active, onPress }: { label: string; sigil: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Text style={[text.monoMicro, { fontSize: 10, color: active ? colors.accent : colors.text }]}>
        <Text style={{ color: colors.accent }}>{sigil} </Text>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 140 },
  input: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
    minHeight: 160,
    padding: 0,
  },
  chip: { fontFamily: fonts.mono.regular, color: colors.accent, letterSpacing: tracking(14, 0.02) },
  toolbar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: 12,
  },
  divider: { width: 1, backgroundColor: colors.rule, alignSelf: 'stretch' },
  flexCenter: { flex: 1, alignItems: 'center' },
});
