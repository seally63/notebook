// Phase 0 demo of a PUSHED detail screen — leading "‹ back" → goBack (stack pop).
// Stands in for /entry/:id, /people/:id, /phrases, etc. until those phases.

import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/Screen';
import { ScreenHeader } from '../components/ScreenHeader';
import { colors, space } from '../theme/tokens';
import { text } from '../theme/typography';

export function DetailDemoScreen() {
  const navigation = useNavigation();
  return (
    <Screen>
      <ScreenHeader title="DETAIL" leading="back" onLeading={() => navigation.goBack()} />
      <View style={{ padding: space.l }}>
        <Text style={[text.body, { color: colors.textSoft, lineHeight: 21 }]}>
          This is a stack push. The leading "‹" pops back to the screen that opened it
          (§1, §10.1). Android hardware/gesture back mirrors it for free.
        </Text>
      </View>
    </Screen>
  );
}
