// /write — ONE screen, two states (§4 / ROUTING note):
//   empty  = ComposeDemo look (placeholder + coachmark + @/# bar)
//   typing = placeholder/coachmark gone, same bar.
// Full §8 autosave: 800ms debounce + force-save on blur/background/nav-away; the
// header heartbeat (SAVING… → DRAFT · SAVED hh:mm); CANCEL → KEEP/DISCARD sheet
// (§8.5); SAVE commits the draft → /entry/:id (§7). Android hardware/gesture back is
// routed through the same KEEP/DISCARD path via navigation's beforeRemove.
//
// Phase 1: the @/# buttons open a "next phase" stub sheet; the editor is plain text
// (rich person/phrase node editing arrives with the pickers in Phases 2–3).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, AppState } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { todayDate } from '../lib/time';
import { composeStamp, formatTime } from '../lib/format';
import { textToNodes, nodesToText } from '../data/body';
import { getTodayDraft, saveDraft, deleteDraft, commitDraft } from '../data/drafts';
import { getEntry, createEntry, updateEntry } from '../data/entries';

type Props = NativeStackScreenProps<RootStackParamList, 'Compose'>;

type SaveState = 'idle' | 'saving' | 'saved';

export function WriteScreen({ route, navigation }: Props) {
  const editEntryId = route.params?.entryId;
  const editMode = !!editEntryId;
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();

  const [body, setBody] = useState('');
  const [date, setDate] = useState(todayDate());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stubOpen, setStubOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const bodyRef = useRef('');
  const initialRef = useRef('');
  const draftIdRef = useRef<string | null>(null);
  const allowLeaveRef = useRef(false);
  const pendingActionRef = useRef<any>(null);
  const stampRef = useRef(new Date());

  // ── load existing draft / entry ───────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (editMode && editEntryId) {
        const e = await getEntry(editEntryId);
        if (e) {
          setDate(e.date);
          const t = nodesToText(e.nodes);
          setBody(t);
          bodyRef.current = t;
          initialRef.current = t;
          stampRef.current = new Date(e.created_at);
        }
      } else {
        const d = await getTodayDraft();
        if (d) {
          draftIdRef.current = d.id;
          const t = nodesToText(d.nodes);
          setBody(t);
          bodyRef.current = t;
          initialRef.current = t;
          stampRef.current = new Date(d.created_at);
          if (t.trim()) {
            setSaveState('saved');
            setSavedAt(formatTime(new Date(d.saved_at ?? d.updated_at)));
          }
        }
      }
      setReady(true);
    })();
  }, [editMode, editEntryId]);

  const persistDraft = useCallback(async () => {
    if (editMode) return;
    const t = bodyRef.current;
    if (!t.trim()) return;
    const id = await saveDraft(date, textToNodes(t));
    draftIdRef.current = id;
  }, [editMode, date]);

  // ── debounced autosave (§8.2) ─────────────────────────────────────────
  useEffect(() => {
    if (editMode || !touched) return;
    if (!body.trim()) {
      setSaveState('idle');
      return;
    }
    setSaveState('saving');
    const t = setTimeout(async () => {
      await persistDraft();
      setSaveState('saved');
      setSavedAt(formatTime(new Date()));
    }, 800);
    return () => clearTimeout(t);
  }, [body, touched, editMode, persistDraft]);

  // ── force-save on background / unmount (call-interruption case) ───────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') persistDraft();
    });
    return () => {
      sub.remove();
      persistDraft();
    };
  }, [persistDraft]);

  // ── intercept back (hardware/gesture/CANCEL) → KEEP/DISCARD (§8.5) ─────
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (allowLeaveRef.current) return;
        const changed = editMode ? bodyRef.current !== initialRef.current : !!bodyRef.current.trim();
        if (!changed) return; // nothing to keep → leave silently
        e.preventDefault();
        pendingActionRef.current = e.data.action;
        setCancelOpen(true);
      }),
    [navigation, editMode],
  );

  const leaveWith = (action: any) => {
    allowLeaveRef.current = true;
    navigation.dispatch(action);
  };

  const onKeepDraft = async () => {
    await persistDraft();
    setCancelOpen(false);
    leaveWith(pendingActionRef.current);
  };

  const onDiscard = async () => {
    if (!editMode && draftIdRef.current) await deleteDraft(draftIdRef.current);
    setCancelOpen(false);
    leaveWith(pendingActionRef.current);
  };

  const onSave = async () => {
    const t = bodyRef.current;
    if (!t.trim()) return;
    const nodes = textToNodes(t);
    allowLeaveRef.current = true;
    if (editMode && editEntryId) {
      await updateEntry(editEntryId, nodes);
      navigation.goBack(); // back to the entry it came from (§8.1)
    } else {
      const id = draftIdRef.current
        ? await commitDraft(draftIdRef.current, date, nodes)
        : await createEntry(date, nodes);
      navigation.replace('Entry', { id }); // §7: go to the entry, not the list
    }
  };

  const onChange = (v: string) => {
    setBody(v);
    bodyRef.current = v;
    if (!touched) setTouched(true);
  };

  const stamp = composeStamp(date, formatTime(stampRef.current));
  const empty = !body.trim();
  const heartbeatVisible = saveState !== 'idle';
  const toolbarBottom = (kb > 0 ? kb : Math.max(insets.bottom, 12)) + 12;
  const editRowsLabel = editMode ? 'CHANGES' : 'DRAFT';

  return (
    <Screen padTop>
      {/* header: CANCEL · heartbeat · SAVE */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          height: 40,
        }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={[text.monoLabel, { fontSize: 10 }]}>CANCEL</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: heartbeatVisible ? 1 : 0 }}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: saveState === 'saving' ? colors.mutedSoft : colors.accent,
            }}
          />
          <Text style={[text.monoMicro, { fontSize: 9 }]}>
            {saveState === 'saving' ? 'SAVING…' : `${editMode ? 'EDITING' : 'DRAFT · SAVED'} ${savedAt ?? ''}`}
          </Text>
        </View>

        <Pressable
          onPress={onSave}
          disabled={empty}
          hitSlop={8}
          style={{
            backgroundColor: colors.text,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: radius.sm,
            opacity: empty ? 0.35 : 1,
          }}>
          <Text style={[text.monoButton, { color: colors.surface, fontSize: 10 }]}>SAVE</Text>
        </Pressable>
      </View>

      {/* date line */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <Text style={[text.monoLabel, { color: colors.accent, fontSize: 11 }]}>{stamp}</Text>
        <View style={{ height: 1, backgroundColor: colors.rule, marginTop: 10 }} />
      </View>

      {/* entry body */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled">
        {ready && (
          <TextInput
            autoFocus={!editMode}
            multiline
            value={body}
            onChangeText={onChange}
            placeholder="What happened today?"
            placeholderTextColor={colors.mutedSoft}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            textAlignVertical="top"
            scrollEnabled={false}
            style={{
              fontFamily: fonts.body.regular,
              fontSize: 14,
              lineHeight: 22,
              color: colors.text,
              minHeight: 160,
              padding: 0,
            }}
          />
        )}

        {/* coachmark — only on a fresh, untouched empty entry */}
        {!editMode && !touched && empty && (
          <View
            style={{
              marginTop: 8,
              padding: 12,
              backgroundColor: colors.accentSoft,
              borderRadius: radius.sm,
            }}>
            <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.textSoft, lineHeight: 17, letterSpacing: 0.4 }}>
              TYPE <Text style={{ color: colors.accent }}>@</Text> TO MENTION SOMEONE,{' '}
              <Text style={{ color: colors.accent }}>#</Text> TO ATTACH A PHRASE.{'\n'}OR TAP THE BAR BELOW.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* writing toolbar — tracks the keyboard (§10.3) */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: toolbarBottom,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.rule,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          paddingVertical: 12,
        }}>
        <ToolbarItem label="MENTION" sigil="@" onPress={() => setStubOpen(true)} />
        <View style={{ width: 1, backgroundColor: colors.rule, alignSelf: 'stretch' }} />
        <ToolbarItem label="PHRASE" sigil="#" onPress={() => setStubOpen(true)} />
        <View style={{ width: 1, backgroundColor: colors.rule, alignSelf: 'stretch' }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[text.monoMicro, { fontSize: 10 }]}>↵ NEW LINE</Text>
        </View>
      </View>

      {/* CANCEL → KEEP / DISCARD (draft already autosaved) */}
      <Sheet visible={cancelOpen} onClose={onKeepDraft}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderBottomWidth: 1,
            borderBottomColor: colors.rule,
          }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent }} />
          <Text style={[text.monoMicro, { fontSize: 10 }]}>
            {editMode ? 'UNSAVED CHANGES' : `DRAFT AUTOSAVED · ${savedAt ?? 'JUST NOW'}`}
          </Text>
        </View>
        <Pressable
          onPress={onKeepDraft}
          style={{ paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.ruleSoft }}>
          <Text style={[text.body, { color: colors.text }]}>{editMode ? 'Keep editing' : 'Keep draft'}</Text>
          <Text style={[text.monoMicro, { fontSize: 10, marginTop: 2, textTransform: 'none' }]}>
            {editMode ? 'come back to these changes' : 'resume anytime from TODAY'}
          </Text>
        </Pressable>
        <Pressable onPress={onDiscard} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
          <Text style={[text.monoButton, { color: colors.accent, fontSize: 11.5 }]}>DISCARD {editRowsLabel}</Text>
        </Pressable>
      </Sheet>

      {/* @/# picker stub — real pickers arrive in Phases 2–3 */}
      <Sheet visible={stubOpen} onClose={() => setStubOpen(false)}>
        <View style={{ padding: 18 }}>
          <Text style={[text.monoLabel, { color: colors.accent }]}>@ MENTION · # PHRASE</Text>
          <Text style={[text.body, { color: colors.textSoft, marginTop: 8, lineHeight: 20 }]}>
            The people and phrase pickers arrive in the next phases. For now, write freely — your draft is
            autosaving.
          </Text>
        </View>
      </Sheet>
    </Screen>
  );
}

function ToolbarItem({ label, sigil, onPress }: { label: string; sigil: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Text style={[text.monoMicro, { fontSize: 10, color: colors.text }]}>
        <Text style={{ color: colors.accent }}>{sigil} </Text>
        {label}
      </Text>
    </Pressable>
  );
}
