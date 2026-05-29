// Carbon — the single Notebook theme.
// Architectural and quiet: white-on-near-white, hairline rules, monospaced metadata,
// one red-orange accent. Values lifted verbatim from design_handoff/notebook-theme.jsx.
//
// Web→RN adaptations made here:
//  - letterSpacing is in POINTS in RN (not `em`). Source values were `em`; we keep the
//    em factors and expose `tracking(fontSize, em)` to compute points at call sites.
//  - fontFamily must name a concrete bundled face (RN does not synthesize weights for
//    custom fonts), so we expose per-weight Geist / Geist Mono family names.
//  - CSS box-shadow does not cross-compile; see `shadows` (Platform.select presets).

import { Platform, type ViewStyle } from 'react-native';

export const ACCENT_DEFAULT = '#D63A2F';

export const colors = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F6F4', // recessed inset panels / grouped tracks
  selected: '#F1F1EE', // hover / selected row fill (reads on white)
  text: '#0A0A0A',
  textSoft: '#262626',
  muted: '#7A7A7A',
  mutedSoft: '#B0B0B0',
  accent: ACCENT_DEFAULT,
  accentSoft: '#FBEDE9', // pale tint of the accent for chip backgrounds
  rule: '#E2E2DE', // container outlines
  ruleSoft: '#ECECE8', // inner dividers
  chip: '#EFEFEC',
  // dock/header border in §9.1 is a touch lighter than `rule`
  hairline: '#E8E8E5',
} as const;

// Type scale in px (RN points). hero 28 / title 20 / lead 16 / body 14 / label 11 / micro 10.
export const type = {
  hero: 28,
  title: 20,
  lead: 16,
  body: 14,
  label: 11,
  micro: 10,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

// Default ("regular") density spacing from the theme factory.
export const space = {
  xs: 4,
  s: 8,
  m: 14,
  l: 22,
  xl: 36,
} as const;

// Numeric weights (kept for reference; in RN we select a concrete family below).
export const weights = {
  light: 350,
  body: 400,
  display: 500,
  bold: 600,
} as const;

// Per-weight font families. These are the names of the bundled static faces
// (see assets/fonts + react-native.config.js). RN matches by PostScript name on
// iOS and by filename on Android — both are "Geist-Regular", etc.
export const fonts = {
  display: {
    light: 'Geist-Light',
    regular: 'Geist-Regular',
    medium: 'Geist-Medium', // display weight 500
    semibold: 'Geist-SemiBold', // bold weight 600
  },
  body: {
    light: 'Geist-Light',
    regular: 'Geist-Regular',
    medium: 'Geist-Medium',
    semibold: 'Geist-SemiBold',
  },
  mono: {
    regular: 'GeistMono-Regular',
    medium: 'GeistMono-Medium',
  },
} as const;

// letterSpacing factors from the source (`em`). Multiply by fontSize for RN points.
export const trackingEm = {
  tight: -0.02, // display headings
  normal: -0.005, // body
  monoLabel: 0.12, // mono uppercase labels (dock, header, chips)
  monoWide: 0.14, // wider mono labels (field labels, NOTE)
  monoButton: 0.18, // mono CTA button labels
} as const;

/** Convert an `em` letter-spacing factor to RN points for a given font size. */
export const tracking = (fontSize: number, em: number): number => fontSize * em;

// Floating-element shadows. The design's shadow is intentionally near-invisible; on
// Android the 1px border carries the edge (see §9.3). Use these presets, don't reinvent.
export const shadows = {
  dock: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 20,
    },
    android: { elevation: 6 },
    default: {},
  })!,
  toolbar: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.06,
      shadowRadius: 20,
    },
    android: { elevation: 6 },
    default: {},
  })!,
  sheet: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 30,
    },
    android: { elevation: 12 },
    default: {},
  })!,
} as const;

export type ThemeColors = typeof colors;

// A single immutable theme object (Carbon). The accent stays overridable at the call
// site if we ever expose the Tweaks panel, but the shipping app uses the default.
export const theme = {
  name: 'Carbon' as const,
  colors,
  type,
  radius,
  space,
  weights,
  fonts,
  trackingEm,
  tracking,
  shadows,
};

export type Theme = typeof theme;
