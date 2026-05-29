// The floating dock (§9) — the ONLY global navigation, shown on the 3 home routes.
// Implemented as a custom bottom-tab bar. Look reproduced from the `Dock` mock in
// notebook-phone.jsx; placement/safe-area/touch behaviour per §9.2–§9.6.
//
//   SEARCH · WRITE · LATELY — 3 equal columns.
//   Active leg = a FULL-HEIGHT accent pill (icon + label white), inactive = muted.

import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Icon, type IconName } from './Icon';
import { colors, radius, shadows } from '../theme/tokens';
import { text } from '../theme/typography';
import { useDockLayout, DOCK_HEIGHT, DOCK_INSET_X } from './dockLayout';

const LEGS: Record<string, { icon: IconName; label: string }> = {
  Search: { icon: 'search', label: 'SEARCH' },
  Write: { icon: 'pen', label: 'WRITE' },
  Lately: { icon: 'lately', label: 'LATELY' },
};

export function Dock({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useDockLayout();

  return (
    <View
      style={[
        {
          position: 'absolute',
          left: DOCK_INSET_X,
          right: DOCK_INSET_X,
          bottom,
          height: DOCK_HEIGHT,
          backgroundColor: colors.surface,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.hairline, // §9.3: the border carries the edge on Android
          flexDirection: 'row',
          alignItems: 'stretch',
        },
        shadows.dock,
      ]}>
      {state.routes.map((route, index) => {
        const leg = LEGS[route.name];
        if (!leg) return null;
        const isActive = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isActive && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        };

        const tint = isActive ? colors.surface : colors.muted;

        return (
          <View key={route.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Pressable
              onPress={onPress}
              hitSlop={8}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={leg.label}
              android_ripple={{ borderless: true }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 7,
                height: '100%',
                paddingHorizontal: isActive ? 16 : 8,
                borderRadius: radius.pill,
                backgroundColor: isActive ? colors.accent : 'transparent',
                opacity: pressed && Platform.OS === 'ios' ? 0.6 : 1,
              })}>
              <Icon name={leg.icon} size={15} color={tint} />
              <Text style={[text.monoLabel, { color: tint, fontSize: 10.5 }]}>{leg.label}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
