// The ↩ undo / ↪ redo control pair for the editor header (compose + edit-on-tap).
// Lives next to CANCEL/SAVE, never touching the back chevron. Each button dims + disables
// when there's nothing to undo/redo. Uses the verbatim Icon set (arrowR mirrored for undo).

import React from 'react';
import { View, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/tokens';

// Small curved-arrow glyphs (undo = counter-clockwise, redo = clockwise), drawn in the
// same 24-viewBox / 1.6 stroke / round-cap style as the rest of the Icon set.
function UndoGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 7L4 12l5 5" />
      <Path d="M4 12h11a5 5 0 0 1 0 10h-1" />
    </Svg>
  );
}
function RedoGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 7l5 5-5 5" />
      <Path d="M20 12H9a5 5 0 0 0 0 10h1" />
    </Svg>
  );
}

export function UndoRedo({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Pressable onPress={onUndo} disabled={!canUndo} hitSlop={10} accessibilityLabel="Undo" style={{ opacity: canUndo ? 1 : 0.3 }}>
        <UndoGlyph color={colors.text} />
      </Pressable>
      <Pressable onPress={onRedo} disabled={!canRedo} hitSlop={10} accessibilityLabel="Redo" style={{ opacity: canRedo ? 1 : 0.3 }}>
        <RedoGlyph color={colors.text} />
      </Pressable>
    </View>
  );
}
