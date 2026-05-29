// Phase 0 placeholder for Lately (`/lately`) — dock·LATELY.
// Real 4-week calendar + carry-overs + quiet rows arrive in Phase 4. The ☰ trailing
// action (→ Settings) is stubbed here.

import React from 'react';
import { Text, ScrollView } from 'react-native';
import { Screen } from '../components/Screen';
import { useDockLayout } from '../components/dockLayout';
import { colors, space } from '../theme/tokens';
import { text } from '../theme/typography';

export function LatelyScreen() {
  const { clearance } = useDockLayout();
  return (
    <Screen padTop>
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: clearance }}>
        <Text style={text.monoLabel}>LATELY</Text>
        <Text style={[text.title, { marginTop: 8 }]}>A relational overview.</Text>
        <Text style={[text.body, { color: colors.textSoft, marginTop: 10, lineHeight: 21 }]}>
          Who you're thinking about, and who's gone quiet. Phase 4.
        </Text>
      </ScrollView>
    </Screen>
  );
}
