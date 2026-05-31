// /entry/:id — a committed entry. EDIT-ON-TAP with a tappable read view:
//   • READ state → read-only <BodyText>. Tapping an inline [name] opens that person's
//     screen (so you know WHICH Chloe); tapping anywhere else in the body starts editing.
//   • EDIT state → the shared <ComposerBody> (inline [name] chips, @ picker) with the
//     CANCEL / SAVE header. There's no "tap EDIT first" step — one tap on the body edits.
//   • entries containing PHRASES → read-only until Phase 3 (rich phrase editor); inline
//     [name] still taps through to /people/:id there.
//
// Autosave is for NEW drafts only (Compose). Editing an existing entry commits on SAVE;
// CANCEL / back while dirty offer KEEP / DISCARD CHANGES (§8.5) and never autosave.

import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, Keyboard } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { BodyText } from '../components/BodyText';
import { ComposerBody } from '../components/ComposerBody';
import { Sheet } from '../components/Sheet';
import { colors, radius } from '../theme/tokens';
import { text } from '../theme/typography';
import { composeStamp, timeFromIso } from '../lib/format';
import { hasPhraseNodes, mentionIds, phraseIds } from '../data/body';
import { type InputState, nodesToInput, inputToNodes } from '../data/mentions';
import { serializeNodes } from '../data/body';
import { getEntry, entryOrdinal, updateEntry, type ParsedEntry } from '../data/entries';
import { resolveRefs, type ResolvedRefs } from '../data/resolve';

type Props = NativeStackScreenProps<RootStackParamList, 'Entry'>;

export function EntryScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const [entry, setEntry] = useState<ParsedEntry | null>(null);
  const [refs, setRefs] = useState<ResolvedRefs>({ people: {}, phrases: {} });
  const [ordinal, setOrdinal] = useState(1);
  const [body, setBody] = useState<InputState>({ text: '', mentions: [] });
  const [editing, setEditing] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const bodyRef = useRef<InputState>({ text: '', mentions: [] });
  const initialSerialized = useRef('[]');
  const entryNodesRef = useRef<ParsedEntry['nodes']>([]);
  const refsRef = useRef<ResolvedRefs>({ people: {}, phrases: {} });
  const editingRef = useRef(false);
  const allowLeaveRef = useRef(false);
  const pendingActionRef = useRef<any>(null);

  const isPhrase = entry ? hasPhraseNodes(entry.nodes) : false;

  const load = useCallback(async () => {
    const e = await getEntry(id);
    if (!e) return;
    setEntry(e);
    entryNodesRef.current = e.nodes;
    setOrdinal(await entryOrdinal(id));
    const r = await resolveRefs([e.nodes]);
    setRefs(r);
    refsRef.current = r;
    if (!hasPhraseNodes(e.nodes)) {
      const state = nodesToInput(e.nodes, (pid) => r.people[pid]?.name);
      setBody(state);
      bodyRef.current = state;
      initialSerialized.current = serializeNodes(inputToNodes(state));
    }
  }, [id]);

  // reload on focus, but NOT while editing (avoid clobbering in-progress edits)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (!editingRef.current && alive) await load();
      })();
      return () => {
        alive = false;
      };
    }, [load]),
  );

  const dirty = () => serializeNodes(inputToNodes(bodyRef.current)) !== initialSerialized.current;

  const setEditingState = (v: boolean) => {
    editingRef.current = v;
    setEditing(v);
  };

  // intercept back while editing + dirty → KEEP / DISCARD CHANGES
  useFocusEffect(
    useCallback(
      () =>
        navigation.addListener('beforeRemove', (e) => {
          if (allowLeaveRef.current) return;
          if (!editingRef.current || !dirty()) return;
          e.preventDefault();
          pendingActionRef.current = e.data.action;
          setCancelOpen(true);
        }),
      [navigation],
    ),
  );

  const onBodyChange = (next: InputState) => {
    bodyRef.current = next;
    setBody(next);
  };

  const startEdit = () => {
    if (!editingRef.current) setEditingState(true);
  };

  const dispatchPending = () => {
    const a = pendingActionRef.current;
    pendingActionRef.current = null;
    if (a) {
      allowLeaveRef.current = true;
      navigation.dispatch(a);
    }
  };

  const saveChanges = async () => {
    const nodes = inputToNodes(bodyRef.current);
    await updateEntry(id, nodes);
    initialSerialized.current = serializeNodes(nodes);
    setEditingState(false);
    Keyboard.dismiss();
    await load();
  };

  const revertChanges = () => {
    const state = nodesToInput(entryNodesRef.current, (pid) => refsRef.current.people[pid]?.name);
    setBody(state);
    bodyRef.current = state;
  };

  const onSave = async () => {
    if (!bodyRef.current.text.trim()) return;
    await saveChanges();
    dispatchPending(); // if SAVE resolved a pending back, leave too
  };

  const onCancel = () => {
    if (dirty()) {
      pendingActionRef.current = null; // CANCEL stays on the entry
      setCancelOpen(true);
    } else {
      setEditingState(false);
      Keyboard.dismiss();
    }
  };

  const onKeepChanges = async () => {
    setCancelOpen(false);
    await saveChanges();
    dispatchPending();
  };

  // backdrop tap = "keep editing" — cancel the leave, stay in the editor
  const onDismissSheet = () => {
    pendingActionRef.current = null;
    setCancelOpen(false);
  };

  const onDiscardChanges = () => {
    revertChanges();
    setCancelOpen(false);
    setEditingState(false);
    Keyboard.dismiss();
    dispatchPending();
  };

  const title = `ENTRY · ${String(ordinal).padStart(3, '0')}`;
  const nMentions = entry ? new Set(mentionIds(entry.nodes)).size : 0;
  const nPhrases = entry ? new Set(phraseIds(entry.nodes)).size : 0;
  const stamp = entry ? composeStamp(entry.date, timeFromIso(entry.created_at)) : '';
  const empty = !body.text.trim();

  return (
    <Screen padTop={editing}>
      {editing ? (
        // editing header: CANCEL · SAVE
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            height: 40,
          }}>
          <Pressable onPress={onCancel} hitSlop={10}>
            <Text style={[text.monoLabel, { fontSize: 10 }]}>CANCEL</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent }} />
            <Text style={[text.monoMicro, { fontSize: 9 }]}>EDITING</Text>
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
      ) : (
        <ScreenHeader title={title} leading="back" onLeading={() => navigation.goBack()} />
      )}

      {entry && (
        <>
          {/* date line */}
          <View style={{ paddingHorizontal: 20, paddingTop: editing ? 14 : 0 }}>
            <Text style={[text.monoLabel, { color: colors.accent, fontSize: 11 }]}>{stamp}</Text>
            <View style={{ height: 1, backgroundColor: colors.rule, marginTop: 10 }} />
          </View>

          {isPhrase ? (
            // read-only (phrases not editable until Phase 3)
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
              <BodyText
                nodes={entry.nodes}
                people={refs.people}
                phrases={refs.phrases}
                onPersonPress={(pid) => navigation.navigate('PersonDetail', { id: pid })}
              />
              <LinkedFooter nMentions={nMentions} nPhrases={nPhrases} />
              <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 16, textTransform: 'none' }]}>
                Entries with phrases can’t be edited yet — that arrives in the next phase.
              </Text>
            </ScrollView>
          ) : editing ? (
            // EDIT state — the shared mention editor
            <ComposerBody
              value={body}
              onChange={onBodyChange}
              autoFocus
              toolbarVisible
              placeholder="Write your entry…"
            />
          ) : (
            // READ state — tappable: [name] → person screen, elsewhere → edit
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
              <Pressable onPress={startEdit} style={{ minHeight: 220 }}>
                <BodyText
                  nodes={entry.nodes}
                  people={refs.people}
                  phrases={refs.phrases}
                  onPersonPress={(pid) => navigation.navigate('PersonDetail', { id: pid })}
                />
                <View style={{ marginTop: 18 }}>
                  {(nMentions > 0 || nPhrases > 0) && <LinkedFooter nMentions={nMentions} nPhrases={nPhrases} />}
                  <Text style={[text.monoMicro, { fontSize: 10, color: colors.mutedSoft, marginTop: 12 }]}>
                    TAP A NAME TO OPEN · TAP TEXT TO EDIT
                  </Text>
                </View>
              </Pressable>
            </ScrollView>
          )}
        </>
      )}

      {/* KEEP / DISCARD CHANGES (edit overlay never autosaves) */}
      <Sheet visible={cancelOpen} onClose={onDismissSheet}>
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
          <Text style={[text.monoMicro, { fontSize: 10 }]}>UNSAVED CHANGES</Text>
        </View>
        <Pressable
          onPress={onKeepChanges}
          style={{ paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.ruleSoft }}>
          <Text style={[text.body, { color: colors.text }]}>Keep changes</Text>
          <Text style={[text.monoMicro, { fontSize: 10, marginTop: 2, textTransform: 'none' }]}>saves your edits to this entry</Text>
        </Pressable>
        <Pressable onPress={onDiscardChanges} style={{ paddingHorizontal: 14, paddingVertical: 14 }}>
          <Text style={[text.monoButton, { color: colors.accent, fontSize: 11.5 }]}>DISCARD CHANGES</Text>
        </Pressable>
      </Sheet>
    </Screen>
  );
}

function LinkedFooter({ nMentions, nPhrases }: { nMentions: number; nPhrases: number }) {
  if (nMentions === 0 && nPhrases === 0) return null;
  return (
    <View
      style={{
        marginTop: 22,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.rule,
        flexDirection: 'row',
        justifyContent: 'space-between',
      }}>
      <Text style={[text.monoMicro, { fontSize: 10 }]}>
        LINKED · {nMentions} {nMentions === 1 ? 'PERSON' : 'PEOPLE'}
        {nPhrases > 0 ? ` · ${nPhrases} PHRASE` : ''}
      </Text>
    </View>
  );
}
