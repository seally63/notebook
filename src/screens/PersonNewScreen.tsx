// /people/new — PeopleQuickAdd (notebook-people.jsx → PeopleQuickAdd). A modal (close-X)
// for creating a person, or editing one when `id` is passed (from PersonDetail ⋯). The
// user types a NAME (required) and an optional NOTE (stored as the person's context).
// Language is inferred later when a phrase is created for them (§12), so there's no
// language picker here — matching the mock.

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { Screen } from '../components/Screen';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';
import { getPerson, insertPerson, updatePerson } from '../data/people';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonNew'>;

export function PersonNewScreen({ route, navigation }: Props) {
  const editId = route.params?.id;
  const editMode = !!editId;
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(!editMode);

  useEffect(() => {
    if (!editMode || !editId) return;
    (async () => {
      const p = await getPerson(editId);
      if (p) {
        setName(p.name);
        setNote(p.context ?? '');
      }
      setLoaded(true);
    })();
  }, [editMode, editId]);

  const canSave = name.trim().length > 0;

  const onSave = useCallback(async () => {
    if (!canSave) return;
    const context = note.trim() ? note.trim() : null;
    if (editMode && editId) await updatePerson(editId, { name: name.trim(), context });
    else await insertPerson({ name: name.trim(), context });
    navigation.goBack();
  }, [canSave, note, editMode, editId, name, navigation]);

  return (
    <Screen padTop>
      {/* close-X header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          height: 44,
        }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Close">
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
        <Text style={[text.monoLabel, { color: colors.text }]}>{editMode ? 'EDIT PERSON' : 'NEW PERSON'}</Text>
        <View style={{ width: 18 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 22 }}
        keyboardShouldPersistTaps="handled">
        <Text style={[text.monoFieldLabel, { marginBottom: 8 }]}>NAME</Text>
        {loaded && (
          <TextInput
            value={name}
            onChangeText={setName}
            autoFocus={!editMode}
            placeholder="Their name"
            placeholderTextColor={colors.mutedSoft}
            autoCapitalize="words"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: colors.rule,
              borderRadius: radius.sm,
              paddingHorizontal: 16,
              paddingVertical: 14,
              fontFamily: fonts.body.semibold,
              fontWeight: '600',
              fontSize: 18,
              color: colors.text,
            }}
          />
        )}

        <Text style={[text.monoFieldLabel, { marginTop: 18, marginBottom: 8 }]}>NOTE</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Where you know them from, what to remember…"
          placeholderTextColor={colors.mutedSoft}
          multiline
          textAlignVertical="top"
          style={{
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: radius.sm,
            paddingHorizontal: 16,
            paddingVertical: 14,
            minHeight: 90,
            fontFamily: fonts.body.regular,
            fontSize: 13.5,
            lineHeight: 21,
            color: colors.textSoft,
          }}
        />

        {!editMode && (
          <View
            style={{
              marginTop: 18,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.rule,
              borderRadius: radius.sm,
            }}>
            <Text style={{ fontFamily: fonts.mono.regular, fontSize: 10, color: colors.muted, lineHeight: 16 }}>
              add more later by mentioning{' '}
              <Text style={{ color: colors.accent }}>[{(name.trim() || 'them').toLowerCase()}]</Text> in any entry.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom, 12) + 12, paddingTop: 8 }}>
        <Button label="SAVE" onPress={onSave} disabled={!canSave} />
      </View>
    </Screen>
  );
}
