// Phase 0 placeholder for Search (`/search`) — dock·SEARCH.
// Real live-filter + BROWSE chips arrive in Phase 4.

import React from 'react';
import { Text, ScrollView } from 'react-native';
import { Screen } from '../components/Screen';
import { useDockLayout } from '../components/dockLayout';
import { colors, space } from '../theme/tokens';
import { text } from '../theme/typography';

export function SearchScreen() {
  const { clearance } = useDockLayout();
  return (
    <Screen padTop>
      <ScrollView contentContainerStyle={{ padding: space.l, paddingBottom: clearance }}>
        <Text style={text.monoLabel}>SEARCH</Text>
        <Text style={[text.title, { marginTop: 8 }]}>Find anything.</Text>
        <Text style={[text.body, { color: colors.textSoft, marginTop: 10, lineHeight: 21 }]}>
          The front door + browse hub for People and Phrases (no tabs). Phase 4.
        </Text>
      </ScrollView>
    </Screen>
  );
}
