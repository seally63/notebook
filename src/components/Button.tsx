// Carbon CTA button — mono uppercase label. filled (black) or outline (hairline).

import React from 'react';
import { Pressable, Text, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme/tokens';
import { text } from '../theme/typography';

export function Button({
  label,
  onPress,
  variant = 'filled',
  disabled = false,
  height = 52,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'filled' | 'outline';
  disabled?: boolean;
  height?: number;
  style?: ViewStyle;
}) {
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          height,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? colors.text : colors.surface,
          borderWidth: filled ? 0 : 1,
          borderColor: colors.rule,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}>
      <Text style={[text.monoButton, { color: filled ? colors.surface : colors.text }]}>{label}</Text>
    </Pressable>
  );
}
