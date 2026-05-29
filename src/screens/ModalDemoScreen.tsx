// Phase 0 demo of a MODAL screen — leading "✕ close" → dismiss (presentation: 'modal').
// Stands in for /settings, /phrases/practise, the @/# and KEEP/DISCARD sheets, etc.

import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, space } from '../theme/tokens';
import { text } from '../theme/typography';

export function ModalDemoScreen() {
  const navigation = useNavigation();
  return (
    <Screen>
      <ScreenHeader title="MODAL" leading="close" onLeading={() => navigation.goBack()} />
      <View style={{ padding: space.l }}>
        <Text style={[text.body, { color: colors.textSoft, lineHeight: 21 }]}>
          This is a modal (presentation: 'modal'). The leading "✕" dismisses it; the
          Android back gesture dismisses it too, not the screen underneath (§10.1).
        </Text>
      </View>
    </Screen>
  );
}
