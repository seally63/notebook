// The shared inline-token editor body — used by both the compose screen (new entry /
// resume draft) and the entry screen (edit-on-tap). A single TextInput rendered with
// styled <Text> children so person `[name]` and phrase `«english»` tokens both appear as
// inline ACCENT CHIPS at the caret. Owns caret tracking, the @/# triggers + pickers, and
// the writing toolbar. The parent owns the value (InputState), header/actions, autosave.
//
// The hard reconciliation logic is pure + unit-tested in src/data/mentions.ts.

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
import {
  type HistoryState,
  initHistory,
  push as pushHistory,
  undo as undoHistory,
  redo as redoHistory,
  canUndo as histCanUndo,
  canRedo as histCanRedo,
  current as histCurrent,
} from '../data/history';
import type { PersonRow, PhraseRow } from '../db/schema';

/** Imperative handle the parent header uses to drive undo/redo. */
export interface ComposerHandle {
  undo: () => void;
  redo: () => void;
}

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
  /** reports whether undo/redo are available, so the parent can enable/dim its buttons. */
  onHistoryChange?: (state: { canUndo: boolean; canRedo: boolean }) => void;
  placeholder?: string;
  /** rendered below the editor inside the scroll (coachmark / hints / footer) */
  children?: React.ReactNode;
}

export const ComposerBody = forwardRef<ComposerHandle, ComposerBodyProps>(function ComposerBody(
  {
    value,
    onChange,
    autoFocus,
    toolbarVisible = true,
    onFocus,
    onCreatePhrase,
    onHistoryChange,
    placeholder = 'What happened today?',
    children,
  },
  ref,
) {
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
  const scrollRef = useRef<ScrollView>(null);
  // when the user dismisses the picker (✕) we suppress the trigger at that sigil index
  // until the text changes again, so the `#…` they typed stays as plain text.
  const dismissedStart = useRef<number | null>(null);
  // true while the caret is at/near the end of the text, so growth = "typing at the
  // bottom" and we should keep that newest line visible above the toolbar. Starts false so
  // simply loading a long entry into edit mode doesn't yank it to the bottom — it flips
  // true only once the user's caret actually sits at the end (focus / selection).
  const caretAtEndRef = useRef(false);

  // ── undo/redo history (in-session, edit text only) ────────────────────────
  const historyRef = useRef<HistoryState>(initHistory(value));
  const applyingHistoryRef = useRef(false); // guards onChange while we apply a snapshot
  const reportHistory = useCallback(() => {
    onHistoryChange?.({ canUndo: histCanUndo(historyRef.current), canRedo: histCanRedo(historyRef.current) });
  }, [onHistoryChange]);

  // seed the baseline when the editor first receives real content (e.g. an entry loads)
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && (value.text.length > 0 || value.tokens.length > 0)) {
      seededRef.current = true;
      historyRef.current = initHistory(value);
      reportHistory();
    }
  }, [value, reportHistory]);

  const applySnapshot = useCallback(
    (snap: InputState) => {
      applyingHistoryRef.current = true;
      onChange(snap); // updates the editor text (rendered via children)
      // IMPORTANT: do NOT force `selection` here. This TextInput renders its text via
      // styled children (for the chips), so a controlled selection forced while the text
      // shrinks parks the caret on a phantom line past the old layout (iOS). Leave the
      // caret uncontrolled — the OS clamps it to the end of the restored (shorter) text —
      // and just sync our internal caret index for trigger detection.
      const pos = Math.max(0, snap.text.length);
      caretRef.current = pos;
      setCaret(pos);
      reportHistory();
      setTimeout(() => {
        applyingHistoryRef.current = false; // resulting onChange (if any) is past the guard
      }, 0);
    },
    [onChange, reportHistory],
  );

  useImperativeHandle(
    ref,
    () => ({
      undo: () => {
        if (!histCanUndo(historyRef.current)) return;
        historyRef.current = undoHistory(historyRef.current);
        applySnapshot(histCurrent(historyRef.current));
      },
      redo: () => {
        if (!histCanRedo(historyRef.current)) return;
        historyRef.current = redoHistory(historyRef.current);
        applySnapshot(histCurrent(historyRef.current));
      },
    }),
    [applySnapshot],
  );

  // record every value change into history (unless we're mid-undo/redo)
  useEffect(() => {
    if (applyingHistoryRef.current) return;
    const before = historyRef.current;
    historyRef.current = pushHistory(before, value);
    if (historyRef.current !== before) reportHistory();
  }, [value, reportHistory]);

  // When the editor's content grows (a new line pushes it taller) and the user is typing
  // at the end, keep the bottom in view so the toolbar never covers the live caret.
  const maybeScrollToCaret = useCallback(() => {
    if (caretAtEndRef.current) scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

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
    caretAtEndRef.current = s.end >= valueRef.current.text.length; // typing at the bottom?
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
  // never let a forced selection point past the current text — that parks the caret on a
  // phantom trailing line on iOS (seen during undo).
  const safeSelection = useMemo(() => {
    if (!pendingSelection) return undefined;
    const max = value.text.length;
    return { start: Math.min(pendingSelection.start, max), end: Math.min(pendingSelection.end, max) };
  }, [pendingSelection, value.text.length]);
  const TOOLBAR_H = 46; // approx height of the writing toolbar bar
  const PICKER_H = 320; // max height of the @/# picker card (matches its maxHeight)
  const BREATHING = 120; // comfortable gap so the active line rests above the toolbar, not
  // jammed against it, when typing near the bottom of a long entry.
  const toolbarBottom = (kb > 0 ? kb : Math.max(insets.bottom, 12)) + 12;
  const pickerBottom = toolbarBottom + 58; // sit above the writing toolbar
  // The ScrollView fills the screen behind the keyboard, so the caret must be able to
  // scroll clear of whatever's floating over it. Normally that's the toolbar; while a
  // picker is open it's the much taller picker card — reserve for whichever is showing,
  // plus breathing room so the caret never sits right at the very bottom edge.
  const overlayH = trigger ? PICKER_H + 58 : TOOLBAR_H;
  const scrollPadBottom = toolbarVisible ? toolbarBottom + overlayH + BREATHING : 40;

  // when a picker opens (or grows), keep the line you're typing on visible above it
  useEffect(() => {
    if (trigger && caretAtEndRef.current) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
      return () => clearTimeout(t);
    }
  }, [trigger]);

  return (
    <>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollPadBottom }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        // we manage keyboard insets manually (toolbar floats above the keyboard), so the
        // OS must not also auto-inset or it double-counts and the caret hides again.
        automaticallyAdjustKeyboardInsets={false}>
        <TextInput
          ref={inputRef}
          autoFocus={autoFocus}
          multiline
          onChangeText={onChangeText}
          selection={safeSelection}
          onSelectionChange={onSelectionChange}
          onFocus={onFocus}
          onContentSizeChange={maybeScrollToCaret}
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
});

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
  scroll: { paddingHorizontal: 20, paddingTop: 16 }, // paddingBottom applied dynamically
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
