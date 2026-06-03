// Inline «english» phrase reference — mono, accent, in guillemets (mirrors PersonRef).
// Tapping it reveals the translation panel (translation + romanisation + ▶) below the
// paragraph. Stub variant (phrase still being created) shows muted, inert.

import React from 'react';
import { Text } from 'react-native';
import { colors, fonts, tracking } from '../theme/tokens';

export function PhraseRef({ en, onPress, muted }: { en: string; onPress?: () => void; muted?: boolean }) {
  return (
    <Text
      onPress={onPress}
      suppressHighlighting
      style={{
        fontFamily: fonts.mono.regular,
        fontSize: 12,
        color: muted ? colors.mutedSoft : colors.accent,
        letterSpacing: tracking(12, 0.02),
      }}>
      «{(en || 'new phrase').trim()}»
    </Text>
  );
}
