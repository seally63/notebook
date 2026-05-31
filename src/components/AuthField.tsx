// Labelled text field for the auth screens (matches AuthField in notebook-auth.jsx):
// mono label + hairline-bordered input, optional SHOW/HIDE for passwords.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, type KeyboardTypeOptions } from 'react-native';
import { colors, radius, fonts } from '../theme/tokens';
import { text } from '../theme/typography';

export function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType,
  autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words' | 'sentences';
}) {
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={[text.monoFieldLabel, { marginBottom: 8 }]}>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.rule,
          borderRadius: radius.sm,
          paddingHorizontal: 14,
        }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedSoft}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          style={{ flex: 1, paddingVertical: 14, fontFamily: fonts.body.regular, fontSize: 14, color: colors.text }}
        />
        {secure && (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <Text style={[text.monoMicro, { fontSize: 10 }]}>{hidden ? 'SHOW' : 'HIDE'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
