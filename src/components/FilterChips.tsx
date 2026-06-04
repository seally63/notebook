// A horizontal row of selectable filter chips (used by the Phrases list + Search). The
// active chip fills with the accent; others are hairline outlines. Scrolls if it overflows.

import React from 'react';
import { Text, Pressable, ScrollView } from 'react-native';
import { colors, radius, fonts, tracking } from '../theme/tokens';

export interface ChipOption {
  key: string;
  label: string;
  count?: number; // optional trailing count
}

export function FilterChips({
  options,
  active,
  onChange,
}: {
  options: ChipOption[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
      {options.map((o) => {
        const sel = o.key === active;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: sel ? colors.accent : colors.rule,
              backgroundColor: sel ? colors.accent : pressed ? colors.selected : colors.surface,
            })}>
            <Text
              style={{
                fontFamily: fonts.mono.regular,
                fontSize: 10,
                letterSpacing: tracking(10, 0.08),
                color: sel ? colors.surface : colors.muted,
              }}>
              {o.label}
              {o.count != null ? ` ${o.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
