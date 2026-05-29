// ScreenHeader — the back/close bar (§10.1).
// height 48, 28px leading slot, centered mono title (10.5, uppercase, 0.12em, muted),
// 28px trailing slot. Renders UNDER the OS status bar via paddingTop: insets.top.
//
// Back vs close is a NAVIGATION CONTRACT, not an icon swap (§1):
//   leading="back"  → `‹`  pushed detail → navigation.goBack() (stack pop)
//   leading="close" → `✕`  modal/sheet   → dismiss the modal
// The caller wires the actual handler; this component only draws + exposes onLeading.

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './Icon';
import { colors } from '../theme/tokens';
import { text } from '../theme/typography';

const HIT = { top: 12, bottom: 12, left: 12, right: 12 };

interface ScreenHeaderProps {
  title?: string;
  leading?: 'back' | 'close' | 'none';
  onLeading?: () => void;
  /** right-hand action (EDIT, + NEW, more…) — a real tap target, not decoration */
  trailing?: React.ReactNode;
  onTrailing?: () => void;
}

export function ScreenHeader({ title, leading = 'back', onLeading, trailing, onTrailing }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: colors.bg }}>
      <View
        style={{
          height: 48,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
        }}>
        {/* leading 28px slot */}
        <View style={{ width: 28, alignItems: 'flex-start' }}>
          {leading !== 'none' && (
            <Pressable
              onPress={onLeading}
              hitSlop={HIT}
              accessibilityRole="button"
              accessibilityLabel={leading === 'back' ? 'Back' : 'Close'}
              style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
              <Icon name={leading} size={leading === 'back' ? 20 : 18} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {/* centered mono title */}
        <Text numberOfLines={1} style={text.monoLabel}>
          {title}
        </Text>

        {/* trailing 28px slot */}
        <View style={{ width: 28, alignItems: 'flex-end' }}>
          {trailing != null && (
            <Pressable
              onPress={onTrailing}
              hitSlop={HIT}
              accessibilityRole="button"
              style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
              {trailing}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
