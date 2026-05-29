// The 3 home routes (§1) as a bottom-tab navigator whose tab bar IS the floating Dock.
// initial route = Write (JournalList) so the app opens on the journal with WRITE active.

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { HomeTabParamList } from './types';
import { Dock } from '../components/Dock';
import { JournalListScreen } from '../screens/JournalListScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { LatelyScreen } from '../screens/LatelyScreen';

const Tab = createBottomTabNavigator<HomeTabParamList>();

// hoisted so it isn't redefined every render (react/no-unstable-nested-components)
const renderDock = (props: React.ComponentProps<typeof Dock>) => <Dock {...props} />;

export function HomeTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Write"
      backBehavior="initialRoute"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: '#FFFFFF' } }}
      tabBar={renderDock}>
      {/* declared in dock order: SEARCH · WRITE · LATELY */}
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Write" component={JournalListScreen} />
      <Tab.Screen name="Lately" component={LatelyScreen} />
    </Tab.Navigator>
  );
}
