// Inset bottom-sheet over a dim backdrop (§10.2 "RN Modal for the simple confirm").
// Used for the KEEP/DISCARD sheet and the Phase 1 @/# "next phase" stub. Android back
// closes it via onRequestClose (matches §8.5: back = the safe default).

import React from 'react';
import { Modal, View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadows } from '../theme/tokens';

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(10,10,10,0.18)' }} />
      <View
        style={[
          {
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: Math.max(insets.bottom, 12) + 8,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.rule,
            borderRadius: radius.md,
            overflow: 'hidden',
          },
          shadows.sheet,
        ]}>
        {children}
      </View>
    </Modal>
  );
}
