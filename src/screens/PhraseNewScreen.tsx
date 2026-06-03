// /phrases/new — PhrasesAdd (§12). The user types ONLY the English. Tagging a person
// auto-sets the language; the target is auto-translated (read-only, tap-to-edit override);
// audio is auto-TTS. Creation is non-blocking: SAVE writes the row immediately (pending
// flags) and the background pipeline fills tgt + audio. Modal (close-X / CANCEL).
//
// Round-trip (§5): when launched from compose's "＋ NEW PHRASE" with a stubLocalId, on
// save we return to the draft so it can swap the stub for the real phrase card.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { Sheet } from '../components/Sheet';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { langShort, langName } from '../lib/lang';
import { listPeople, getPerson } from '../data/people';
import { createPhrase } from '../data/phrases';
import type { PersonRow } from '../db/schema';

type Props = NativeStackScreenProps<RootStackParamList, 'PhraseNew'>;

const LANGS: { code: string; short: string; name: string }[] = [
  { code: 'pl-PL', short: 'PL', name: 'POLISH' },
  { code: 'uk-UA', short: 'UK', name: 'UKRAINIAN' },
  { code: 'ru-RU', short: 'RU', name: 'RUSSIAN' },
];

export function PhraseNewScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const initialEn = route.params?.en ?? '';
  const initialPerson = route.params?.personId ?? null;
  const stubLocalId = route.params?.stubLocalId;

  const [en, setEn] = useState(initialEn);
  const [forPerson, setForPerson] = useState<string | null>(initialPerson);
  const [lang, setLang] = useState<string | null>(null);
  const [langAuto, setLangAuto] = useState(false); // language came from the person
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [personSheet, setPersonSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listPeople().then(setPeople);
  }, []);

  // when a person is chosen, infer language from them (overridable)
  useEffect(() => {
    if (!forPerson) return;
    (async () => {
      const p = await getPerson(forPerson);
      if (p?.lang) {
        setLang(p.lang);
        setLangAuto(true);
      }
    })();
  }, [forPerson]);

  const personName = people.find((p) => p.id === forPerson)?.name;
  const canSave = en.trim().length > 0 && !!lang;

  const onSave = useCallback(async () => {
    if (!canSave || !lang) return;
    setSaving(true);
    // §5: when launched from an in-text stub, create the phrase WITH the stub's local_id as
    // its id. The editor then resolves the stub by a plain DB lookup on focus — robust, no
    // reliance on navigation params surviving the modal dismiss.
    await createPhrase({ id: stubLocalId, en: en.trim(), lang, forPerson });
    setSaving(false);
    navigation.goBack(); // the opener re-resolves stubs when it regains focus
  }, [canSave, lang, en, forPerson, stubLocalId, navigation]);

  const pickLang = (code: string) => {
    setLang(code);
    setLangAuto(false);
  };

  return (
    <Screen padTop>
      {/* CANCEL · NEW PHRASE header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          height: 44,
        }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={[text.monoLabel, { fontSize: 10 }]}>CANCEL</Text>
        </Pressable>
        <Text style={[text.monoLabel, { color: colors.text }]}>NEW PHRASE</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14 }} keyboardShouldPersistTaps="handled">
        {/* ENGLISH — the only required input */}
        <FieldLabel label="ENGLISH" note="YOU TYPE THIS" />
        <TextInput
          value={en}
          onChangeText={setEn}
          autoFocus={!initialEn}
          placeholder="A phrase you want to say…"
          placeholderTextColor={colors.mutedSoft}
          multiline
          style={{
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: radius.sm,
            paddingHorizontal: 14,
            paddingVertical: 13,
            fontFamily: fonts.body.regular,
            fontSize: 14,
            lineHeight: 21,
            color: colors.text,
            minHeight: 52,
          }}
        />

        {/* FOR (person) — sets the language */}
        <FieldLabel label="FOR (OPTIONAL)" note="SETS THE LANGUAGE ↓" />
        <Pressable
          onPress={() => setPersonSheet(true)}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: radius.sm,
            paddingHorizontal: 14,
            paddingVertical: 13,
          }}>
          {personName ? (
            <Text style={{ fontFamily: fonts.mono.regular, fontSize: 12, color: colors.accent }}>
              [{personName.toLowerCase()}]
            </Text>
          ) : (
            <Text style={[text.body, { color: colors.mutedSoft }]}>No one in particular</Text>
          )}
          <Icon name="chev" size={14} color={colors.muted} />
        </Pressable>

        {/* LANGUAGE — auto from person, overridable */}
        <FieldLabel label="LANGUAGE" note={langAuto && personName ? `AUTO · FROM [${personName.toUpperCase()}]` : undefined} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {LANGS.map((l) => {
            const sel = l.code === lang;
            return (
              <Pressable
                key={l.code}
                onPress={() => pickLang(l.code)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  alignItems: 'center',
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: sel ? colors.text : colors.rule,
                  backgroundColor: sel ? colors.text : colors.surface,
                }}>
                <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.8, color: sel ? colors.surface : colors.muted }}>
                  {l.short} · {l.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* what happens on save (the target + audio are generated after) */}
        <View
          style={{
            marginTop: 20,
            padding: 13,
            backgroundColor: colors.accentSoft,
            borderRadius: radius.sm,
          }}>
          <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.textSoft, lineHeight: 17, letterSpacing: 0.3 }}>
            ON SAVE: WE TRANSLATE TO{' '}
            <Text style={{ color: colors.accent }}>{lang ? (langName(lang) ?? langShort(lang)) : 'THE LANGUAGE'}</Text>{' '}
            AND GENERATE AUDIO AUTOMATICALLY. YOU CAN EDIT THE TRANSLATION AFTERWARD.
          </Text>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 12) + 12, paddingTop: 8 }}>
        <Button label={saving ? 'SAVING…' : 'SAVE PHRASE'} onPress={onSave} disabled={!canSave || saving} />
      </View>

      {/* person picker */}
      <Sheet visible={personSheet} onClose={() => setPersonSheet(false)}>
        <View style={{ maxHeight: 360 }}>
          <Pressable
            onPress={() => {
              setForPerson(null);
              setPersonSheet(false);
            }}
            style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.ruleSoft }}>
            <Text style={[text.body, { color: colors.muted }]}>No one in particular</Text>
          </Pressable>
          <ScrollView keyboardShouldPersistTaps="always">
            {people.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  setForPerson(p.id);
                  setPersonSheet(false);
                }}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 13,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.ruleSoft,
                }}>
                <Text style={[text.body, { fontSize: 13.5 }]}>{p.name}</Text>
                <Text style={{ fontFamily: fonts.mono.regular, fontSize: 9.5, color: p.lang ? colors.accent : colors.mutedSoft }}>
                  {langShort(p.lang) ?? 'EN'}
                </Text>
              </Pressable>
            ))}
            {people.length === 0 && (
              <Text style={[text.monoMicro, { fontSize: 10, padding: 16, textAlign: 'center' }]}>
                NO PEOPLE YET
              </Text>
            )}
          </ScrollView>
        </View>
      </Sheet>
    </Screen>
  );
}

function FieldLabel({ label, note }: { label: string; note?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
      <Text style={[text.monoFieldLabel]}>{label}</Text>
      {!!note && <Text style={[text.monoMicro, { fontSize: 10, color: colors.accent, textTransform: 'none' }]}>{note}</Text>}
    </View>
  );
}
