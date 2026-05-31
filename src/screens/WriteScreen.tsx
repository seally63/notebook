// /write (Compose) — a NEW entry or resuming today's draft. ONE screen, two states (§4):
//   empty  = placeholder + coachmark + @/# bar
//   typing = placeholder/coachmark gone, same bar.
//
// Editing an EXISTING entry no longer lives here — that's edit-on-tap in EntryScreen.
// The mention editor itself is the shared <ComposerBody>.
//
// Full §8 autosave: 800ms debounce + force-save on blur/background/nav-away; the header
// heartbeat (SAVING… → DRAFT · SAVED hh:mm); CANCEL → KEEP/DISCARD sheet (§8.5); SAVE
// commits the draft → /entry/:id (§7). Android hardware/gesture back routes through the
// same KEEP/DISCARD path via navigation's beforeRemove.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, AppState } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { ComposerBody } from '../components/ComposerBody';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { todayDate } from '../lib/time';
import { composeStamp, formatTime } from '../lib/format';
import { type InputState, nodesToInput, inputToNodes } from '../data/mentions';
import { getTodayDraft, saveDraft, deleteDraft, commitDraft } from '../data/drafts';
import { createEntry } from '../data/entries';
import { resolveRefs } from '../data/resolve';

type Props = NativeStackScreenProps<RootStackParamList, 'Compose'>;
type SaveState = 'idle' | 'saving' | 'saved';

export function WriteScreen({ navigation }: Props) {
  const [body, setBody] = useState<InputState>({ text: '', mentions: [] });
  const [date] = useState(todayDate());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stubOpen, setStubOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const bodyRef = useRef<InputState>({ text: '', mentions: [] });
  const draftIdRef = useRef<string | null>(null);
  const allowLeaveRef = useRef(false);
  const pendingActionRef = useRef<any>(null);
  const stampRef = useRef(new Date());

  const setBodyState = useCallback((next: InputState) => {
    bodyRef.current = next;
    setBody(next);
  }, []);

  // ── resume today's draft if one exists ────────────────────────────────
  useEffect(() => {
    (async () => {
      const d = await getTodayDraft();
      if (d) {
        draftIdRef.current = d.id;
        const refs = await resolveRefs([d.nodes]);
        const state = nodesToInput(d.nodes, (id) => refs.people[id]?.name);
        setBodyState(state);
        stampRef.current = new Date(d.created_at);
        if (state.text.trim()) {
          setSaveState('saved');
          setSavedAt(formatTime(new Date(d.saved_at ?? d.updated_at)));
        }
      }
      setReady(true);
    })();
  }, [setBodyState]);

  const persistDraft = useCallback(async () => {
    if (!bodyRef.current.text.trim()) return;
    const id = await saveDraft(date, inputToNodes(bodyRef.current));
    draftIdRef.current = id;
  }, [date]);

  // ── debounced autosave (§8.2) ─────────────────────────────────────────
  useEffect(() => {
    if (!touched) return;
    if (!body.text.trim()) {
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
  }, [body, touched, persistDraft]);

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
        if (!bodyRef.current.text.trim()) return; // nothing to keep → leave silently
        e.preventDefault();
        pendingActionRef.current = e.data.action;
        setCancelOpen(true);
      }),
    [navigation],
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
    if (draftIdRef.current) await deleteDraft(draftIdRef.current);
    setCancelOpen(false);
    leaveWith(pendingActionRef.current);
  };

  const onSave = async () => {
    if (!bodyRef.current.text.trim()) return;
    const nodes = inputToNodes(bodyRef.current);
    allowLeaveRef.current = true;
    const id = draftIdRef.current
      ? await commitDraft(draftIdRef.current, date, nodes)
      : await createEntry(date, nodes);
    navigation.replace('Entry', { id }); // §7: go to the entry, not the list
  };

  const onChange = (next: InputState) => {
    if (!touched) setTouched(true);
    setBodyState(next);
  };

  const stamp = composeStamp(date, formatTime(stampRef.current));
  const empty = !body.text.trim();
  const heartbeatVisible = saveState !== 'idle';

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
            {saveState === 'saving' ? 'SAVING…' : `DRAFT · SAVED ${savedAt ?? ''}`}
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

      {/* shared mention editor */}
      {ready && (
        <ComposerBody value={body} onChange={onChange} autoFocus onRequestPhrase={() => setStubOpen(true)}>
          {!touched && empty && (
            <View style={{ marginTop: 8, padding: 12, backgroundColor: colors.accentSoft, borderRadius: radius.sm }}>
              <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.textSoft, lineHeight: 17, letterSpacing: 0.4 }}>
                TYPE <Text style={{ color: colors.accent }}>@</Text> TO MENTION SOMEONE,{' '}
                <Text style={{ color: colors.accent }}>#</Text> TO ATTACH A PHRASE.{'\n'}OR TAP THE BAR BELOW.
              </Text>
            </View>
          )}
        </ComposerBody>
      )}

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
          <Text style={[text.monoMicro, { fontSize: 10 }]}>{`DRAFT AUTOSAVED · ${savedAt ?? 'JUST NOW'}`}</Text>
        </View>
        <Pressable
          onPress={onKeepDraft}
          style={{ paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.ruleSoft }}>
          <Text style={[text.body, { color: colors.text }]}>Keep draft</Text>
          <Text style={[text.monoMicro, { fontSize: 10, marginTop: 2, textTransform: 'none' }]}>resume anytime from TODAY</Text>
        </Pressable>
        <Pressable onPress={onDiscard} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
          <Text style={[text.monoButton, { color: colors.accent, fontSize: 11.5 }]}>DISCARD DRAFT</Text>
        </Pressable>
      </Sheet>

      {/* # phrase picker stub — real phrase picker arrives in Phase 3 */}
      <Sheet visible={stubOpen} onClose={() => setStubOpen(false)}>
        <View style={{ padding: 18 }}>
          <Text style={[text.monoLabel, { color: colors.accent }]}># ATTACH A PHRASE</Text>
          <Text style={[text.body, { color: colors.textSoft, marginTop: 8, lineHeight: 20 }]}>
            The phrase picker (with auto-translation + audio) arrives in the next phase. For now, write freely
            and mention people with @ — your draft is autosaving.
          </Text>
        </View>
      </Sheet>
    </Screen>
  );
}
