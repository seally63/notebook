// Dock geometry, derived from the safe area (§9.2 / §9.4) — not the mock's hardcoded
// bottom:20 / paddingBottom:96, which ignore the home indicator + gesture bar.

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const DOCK_HEIGHT = 50; // §9.1 floating pill height
export const DOCK_INSET_X = 22; // §9.1 horizontal inset to screen edge

export function useDockLayout() {
  const insets = useSafeAreaInsets();
  // distance from screen bottom to the pill (§9.2): ≈20 on button-nav, ~42 on notched iPhone
  const bottom = Math.max(insets.bottom, 12) + 8;
  // content clearance so scroll views don't hide under the pill (§9.4)
  const clearance = DOCK_HEIGHT + bottom + 16;
  return { bottom, clearance, height: DOCK_HEIGHT, insetX: DOCK_INSET_X };
}
