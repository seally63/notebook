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
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/Sheet';
import { ComposerBody } from '../components/ComposerBody';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { todayDate } from '../lib/time';
import { composeStamp, formatTime } from '../lib/format';
import { type InputState, nodesToInput, inputToNodes, resolvePhraseStubs } from '../data/mentions';
import { getTodayDraft, saveDraft, deleteDraft, commitDraft } from '../data/drafts';
import { createEntry } from '../data/entries';
import { getPhrase } from '../data/phrases';
import { resolveRefs } from '../data/resolve';

type Props = NativeStackScreenProps<RootStackParamList, 'Compose'>;
type SaveState = 'idle' | 'saving' | 'saved';

/** chips are inline in the text now, so any non-whitespace text counts as content (§8.2). */
const hasContent = (s: InputState): boolean => s.text.trim().length > 0;

export function WriteScreen({ navigation }: Props) {
  const [body, setBody] = useState<InputState>({ text: '', tokens: [] });
  const [date] = useState(todayDate());
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const bodyRef = useRef<InputState>({ text: '', tokens: [] });
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
        const state = nodesToInput(d.nodes, (id) => refs.people[id]?.name, (phid) => refs.phrases[phid]?.en);
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

  // §5 stub resolve: on focus (e.g. returning from ＋NEW PHRASE) upgrade any in-text
  // phrase_stub whose local_id now exists as a real phrase — a robust DB lookup, not a
  // navigation param. Persists the draft so the resolved chip survives.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const stubs = bodyRef.current.tokens.filter((t) => t.kind === 'phrase_stub');
        if (stubs.length === 0) return;
        const enById: Record<string, string | undefined> = {};
        for (const s of stubs) if (s.kind === 'phrase_stub') enById[s.localId] = (await getPhrase(s.localId))?.en;
        if (!alive) return;
        const next = resolvePhraseStubs(bodyRef.current, (pid) => enById[pid]);
        if (next === bodyRef.current) return;
        setBodyState(next);
        setTouched(true);
        await saveDraft(date, inputToNodes(next));
      })();
      return () => {
        alive = false;
      };
    }, [date, setBodyState]),
  );

  const persistDraft = useCallback(async () => {
    if (!hasContent(bodyRef.current)) return;
    const id = await saveDraft(date, inputToNodes(bodyRef.current));
    draftIdRef.current = id;
  }, [date]);

  // ── debounced autosave (§8.2) ─────────────────────────────────────────
  useEffect(() => {
    if (!touched) return;
    if (!hasContent(body)) {
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
        if (!hasContent(bodyRef.current)) return; // nothing to keep → leave silently
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
    if (!hasContent(bodyRef.current)) return;
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

  // §5: "＋ NEW PHRASE" inserted a stub — autosave the draft (so text survives the trip),
  // then open /phrases/new; the resolveStub param swaps the stub on return.
  const onCreatePhrase = async (stubLocalId: string, en: string) => {
    await persistDraft();
    navigation.navigate('PhraseNew', { stubLocalId, en });
  };

  const stamp = composeStamp(date, formatTime(stampRef.current));
  const empty = !hasContent(body);
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
        <ComposerBody value={body} onChange={onChange} autoFocus onCreatePhrase={onCreatePhrase}>
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
    </Screen>
  );
}
