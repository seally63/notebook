// Root native-stack: the home tabs + every pushed/modal screen (§1).
// We render our own <ScreenHeader>, so the native header is always hidden. The
// back(‹)/close(✕) contract is expressed by `presentation`: default = push,
// 'modal' = modal (Android back dismisses modals correctly — §10.1).

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { HomeTabs } from './HomeTabs';
import { DetailDemoScreen } from '../screens/DetailDemoScreen';
import { ModalDemoScreen } from '../screens/ModalDemoScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeTabs} />
      <Stack.Screen name="DetailDemo" component={DetailDemoScreen} />
      <Stack.Screen name="ModalDemo" component={ModalDemoScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
