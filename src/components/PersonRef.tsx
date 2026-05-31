// Inline [name] reference — mono, accent, lowercased (matches PersonRef in the mocks).
// Tapping → /people/:id is wired in Phase 2; Phase 1 renders it inert.

import React from 'react';
import { Text } from 'react-native';
import { colors, fonts, tracking } from '../theme/tokens';

export function PersonRef({ name, onPress }: { name: string; onPress?: () => void }) {
  return (
    <Text
      onPress={onPress}
      suppressHighlighting
      style={{ fontFamily: fonts.mono.regular, fontSize: 12, color: colors.accent, letterSpacing: tracking(12, 0.04) }}>
      [{name.toLowerCase()}]
    </Text>
  );
}
