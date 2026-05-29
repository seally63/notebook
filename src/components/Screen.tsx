// Screen wrapper — the Carbon page. White background + a real dark-content status bar
// (the mock drew a fake 28px bar; on device the OS owns insets.top — §10.1).
//
// Top inset is NOT added here: pushed/modal screens get it from <ScreenHeader>, and
// header-less home screens opt in via `padTop`. This avoids the double-padding trap.

import React from 'react';
import { View, StatusBar, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  backgroundColor?: string;
  /** pad the top by the status-bar inset (for header-less screens). default false */
  padTop?: boolean;
  style?: ViewStyle;
}

export function Screen({ children, backgroundColor = colors.bg, padTop = false, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor, paddingTop: padTop ? insets.top : 0 }, style]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {children}
    </View>
  );
}
