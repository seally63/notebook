// The shared inline-token editor body — used by both the compose screen (new entry /
// resume draft) and the entry screen (edit-on-tap). A single TextInput rendered with
// styled <Text> children so person `[name]` and phrase `«english»` tokens both appear as
// inline ACCENT CHIPS at the caret. Owns caret tracking, the @/# triggers + pickers, and
// the writing toolbar. The parent owns the value (InputState), header/actions, autosave.
//
// The hard reconciliation logic is pure + unit-tested in src/data/mentions.ts.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MentionPicker } from './MentionPicker';
import { PhrasePicker } from './PhrasePicker';
import { colors, radius, fonts, tracking } from '../theme/tokens';
import { text } from '../theme/typography';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import {
  type InputState,
  type Token,
  reconcile,
  insertPerson as insertPersonToken,
  insertPhrase as insertPhraseToken,
  insertPhraseStub,
  findTrigger,
} from '../data/mentions';
import { listPeople, insertPerson } from '../data/people';
import { listPhrases } from '../data/phrases';
import { newId } from '../lib/uuid';
import type { PersonRow, PhraseRow } from '../db/schema';

export interface ComposerBodyProps {
  value: InputState;
  onChange: (next: InputState) => void;
  autoFocus?: boolean;
  /** show the writing toolbar + enable the @/# pickers. */
  toolbarVisible?: boolean;
  onFocus?: () => void;
  /** §5 "＋ NEW PHRASE": parent persists the draft + navigates to /phrases/new with the
   *  stub's local_id (to resolve on return) and the typed English (to prefill). */
  onCreatePhrase?: (stubLocalId: string, en: string) => void;
  placeholder?: string;
  /** rendered below the editor inside the scroll (coachmark / hints / footer) */
  children?: React.ReactNode;
}

export function ComposerBody({
  value,
  onChange,
  autoFocus,
  toolbarVisible = true,
  onFocus,
  onCreatePhrase,
  placeholder = 'What happened today?',
  children,
}: ComposerBodyProps) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [phrases, setPhrases] = useState<PhraseRow[]>([]);
  const [caret, setCaret] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<{ start: number; end: number } | undefined>(undefined);
  const [trigger, setTrigger] = useState<{ sigil: '@' | '#'; start: number; query: string } | null>(null);
  const caretRef = useRef(0);
  const valueRef = useRef(value);
  valueRef.current = value;
  const inputRef = useRef<TextInput>(null);
  // when the user dismisses the picker (✕) we suppress the trigger at that sigil index
  // until the text changes again, so the `#…` they typed stays as plain text.
  const dismissedStart = useRef<number | null>(null);

  useEffect(() => {
    listPeople().then(setPeople);
    listPhrases().then(setPhrases);
  }, []);

  const moveCaret = useCallback((pos: number) => {
    caretRef.current = pos;
    setCaret(pos);
    setPendingSelection({ start: pos, end: pos });
  }, []);

  // recompute the active @/# trigger whenever text/caret/tokens change (off when inert)
  useEffect(() => {
    const tr = toolbarVisible ? findTrigger(value.text, caret, value.tokens) : null;
    // honour an explicit dismiss until the user moves off that sigil
    setTrigger(tr && tr.start === dismissedStart.current ? null : tr);
  }, [value, caret, toolbarVisible]);

  const onChangeText = (next: string) => {
    dismissedStart.current = null; // typing re-arms the picker
    onChange(reconcile(valueRef.current.text, valueRef.current.tokens, next));
  };

  const dismissTrigger = () => {
    if (trigger) dismissedStart.current = trigger.start;
    setTrigger(null);
  };

  const onSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const s = e.nativeEvent.selection;
    caretRef.current = s.start;
    setCaret(s.start);
    if (pendingSelection) setPendingSelection(undefined); // forced caret applied
  };

  // insert a sigil at the caret (toolbar buttons) so the trigger detector picks it up
  const openTrigger = (sigil: '@' | '#') => {
    const pos = caretRef.current;
    const t = valueRef.current.text;
    const needsSpace = pos > 0 && !/\s/.test(t[pos - 1]);
    const ins = (needsSpace ? ' ' : '') + sigil;
    const newText = t.slice(0, pos) + ins + t.slice(pos);
    onChange(reconcile(t, valueRef.current.tokens, newText));
    moveCaret(pos + ins.length);
    inputRef.current?.focus();
  };

  // ── people ────────────────────────────────────────────────────────────
  const pickPerson = (person: PersonRow) => {
    if (!trigger) return;
    const r = insertPersonToken(valueRef.current, trigger.start, caretRef.current, person.id, person.name);
    onChange({ text: r.text, tokens: r.tokens });
    moveCaret(r.caret);
    setTrigger(null);
  };

  const createAndPickPerson = async (name: string) => {
    const tr = trigger;
    if (!tr) return;
    const id = await insertPerson({ name });
    const all = await listPeople();
    setPeople(all);
    const person = all.find((p) => p.id === id);
    if (person) {
      const r = insertPersonToken(valueRef.current, tr.start, caretRef.current, person.id, person.name);
      onChange({ text: r.text, tokens: r.tokens });
      moveCaret(r.caret);
      setTrigger(null);
    }
  };

  // ── phrases ───────────────────────────────────────────────────────────
  const attachPhrase = (phrase: PhraseRow) => {
    if (!trigger) return;
    const r = insertPhraseToken(valueRef.current, trigger.start, caretRef.current, phrase.id, phrase.en);
    onChange({ text: r.text, tokens: r.tokens });
    moveCaret(r.caret);
    setTrigger(null);
  };

  // ＋ NEW PHRASE: insert a stub chip in place of the #query, then hand the local_id up
  // so the parent autosaves + opens /phrases/new (resolves the stub on return).
  const createPhrase = (prefillEn: string) => {
    if (!trigger) return;
    const en = prefillEn.trim();
    const localId = newId();
    const r = insertPhraseStub(valueRef.current, trigger.start, caretRef.current, localId, en || 'new phrase');
    onChange({ text: r.text, tokens: r.tokens });
    moveCaret(r.caret);
    setTrigger(null);
    onCreatePhrase?.(localId, en);
  };

  const editorChildren = useMemo(() => buildChildren(value), [value]);
  const toolbarBottom = (kb > 0 ? kb : Math.max(insets.bottom, 12)) + 12;
  const pickerBottom = toolbarBottom + 58; // sit above the writing toolbar

  return (
    <>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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

      {toolbarVisible && trigger?.sigil === '@' && (
        <MentionPicker
          visible
          query={trigger.query}
          people={people}
          bottom={pickerBottom}
          onSelect={pickPerson}
          onCreate={createAndPickPerson}
          onClose={dismissTrigger}
        />
      )}

      {toolbarVisible && trigger?.sigil === '#' && (
        <PhrasePicker
          visible
          query={trigger.query}
          phrases={phrases}
          people={Object.fromEntries(people.map((p) => [p.id, p]))}
          bottom={pickerBottom}
          onSelect={attachPhrase}
          onCreate={createPhrase}
          onClose={dismissTrigger}
        />
      )}

      {toolbarVisible && (
        <View style={[styles.toolbar, { bottom: toolbarBottom }]}>
          <ToolbarItem label="MENTION" sigil="@" active={trigger?.sigil === '@'} onPress={() => openTrigger('@')} />
          <View style={styles.divider} />
          <ToolbarItem label="PHRASE" sigil="#" active={trigger?.sigil === '#'} onPress={() => openTrigger('#')} />
          <View style={styles.divider} />
          <View style={styles.flexCenter}>
            <Text style={[text.monoMicro, { fontSize: 10 }]}>↵ NEW LINE</Text>
          </View>
        </View>
      )}
    </>
  );
}

/** Split (text, tokens) into styled <Text> runs: tokens render accent, mono. */
function buildChildren(state: InputState): React.ReactNode {
  const { text: t } = state;
  const tokens: Token[] = [...state.tokens].sort((a, b) => a.start - b.start);
  if (tokens.length === 0) return t.length ? t : null;
  const out: React.ReactNode[] = [];
  let cur = 0;
  tokens.forEach((tok, i) => {
    if (tok.start > cur) out.push(<Text key={`t${i}`}>{t.slice(cur, tok.start)}</Text>);
    out.push(
      <Text key={`k${i}`} style={styles.chip}>
        {t.slice(tok.start, tok.end)}
      </Text>,
    );
    cur = tok.end;
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
