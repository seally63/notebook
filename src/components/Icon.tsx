// The Notebook icon set — hand-drawn SVGs ported VERBATIM from the `Icon` object in
// design_handoff/notebook-phone.jsx (ROUTING §11). Path data is copied exactly; the
// only change is web `currentColor` → the RN `color` prop, so a single icon flips
// white inside the active dock pill. Do NOT substitute an icon library.
//
// Conventions (kept from the source): viewBox 0 0 24 24, strokeWidth 1.6,
// strokeLinecap/Linejoin round, fill none — except the solid glyphs (play, more,
// lately dots, toggle knob) which fill with `color`.

import React from 'react';
import { Svg, Path, Circle, Rect } from 'react-native-svg';
import { colors } from '../theme/tokens';

export type IconName =
  | 'search'
  | 'plus'
  | 'pen'
  | 'lately'
  | 'play'
  | 'speaker'
  | 'chev'
  | 'back'
  | 'close'
  | 'more'
  | 'hamburger'
  | 'toggle'
  | 'arrowR';

// Default sizes from the source (the px each Icon.x(size) defaults to).
const DEFAULT_SIZE: Record<IconName, number> = {
  search: 18,
  plus: 18,
  pen: 18,
  lately: 18,
  play: 14,
  speaker: 16,
  chev: 16,
  back: 18,
  close: 18,
  more: 18,
  hamburger: 18,
  toggle: 20,
  arrowR: 14,
};

export interface IconProps {
  name: IconName;
  /** pixel size; falls back to the source default for the icon */
  size?: number;
  /** maps to `currentColor` in the source */
  color?: string;
  /** toggle only: drawn "on" (filled track, knob right) */
  on?: boolean;
}

const SW = 1.6;

export function Icon({ name, size, color = colors.text, on = false }: IconProps) {
  const s = size ?? DEFAULT_SIZE[name];

  switch (name) {
    case 'search':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round">
          <Circle cx={11} cy={11} r={6.5} />
          <Path d="M20 20l-4-4" />
        </Svg>
      );
    case 'plus':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round">
          <Path d="M12 5v14M5 12h14" />
        </Svg>
      );
    case 'pen':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 20l3.5-.8L19 7.7a1.5 1.5 0 0 0 0-2.1l-.6-.6a1.5 1.5 0 0 0-2.1 0L4.8 16.5 4 20z" />
        </Svg>
      );
    case 'lately':
      // 3×3 dot grid; some dots dimmed via opacity (calendar/recency in spirit)
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round">
          <Circle cx={6} cy={6} r={1.1} fill={color} stroke="none" />
          <Circle cx={12} cy={6} r={1.1} fill={color} stroke="none" />
          <Circle cx={18} cy={6} r={1.1} fill={color} stroke="none" opacity={0.35} />
          <Circle cx={6} cy={12} r={1.1} fill={color} stroke="none" opacity={0.35} />
          <Circle cx={12} cy={12} r={1.1} fill={color} stroke="none" />
          <Circle cx={18} cy={12} r={1.1} fill={color} stroke="none" />
          <Circle cx={6} cy={18} r={1.1} fill={color} stroke="none" opacity={0.35} />
          <Circle cx={12} cy={18} r={1.1} fill={color} stroke="none" opacity={0.35} />
          <Circle cx={18} cy={18} r={1.1} fill={color} stroke="none" />
        </Svg>
      );
    case 'play':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill={color}>
          <Path d="M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5z" />
        </Svg>
      );
    case 'speaker':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M4 9h3l4-3v12l-4-3H4z" />
          <Path d="M15 9c1.2 1 1.2 5 0 6" />
          <Path d="M17.5 6.5c2.5 2 2.5 9 0 11" />
        </Svg>
      );
    case 'chev':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M9 6l6 6-6 6" />
        </Svg>
      );
    case 'back':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M15 6l-6 6 6 6" />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round">
          <Path d="M6 6l12 12M18 6L6 18" />
        </Svg>
      );
    case 'more':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill={color}>
          <Circle cx={6} cy={12} r={1.3} />
          <Circle cx={12} cy={12} r={1.3} />
          <Circle cx={18} cy={12} r={1.3} />
        </Svg>
      );
    case 'hamburger':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round">
          <Path d="M4 8h16M4 16h16" />
        </Svg>
      );
    case 'toggle':
      // source: width s*1.6, height s, viewBox 0 0 32 20
      return (
        <Svg width={s * 1.6} height={s} viewBox="0 0 32 20" fill="none">
          <Rect x={0.5} y={0.5} width={31} height={19} rx={9.5} fill={on ? color : 'none'} stroke={color} strokeWidth={1} />
          <Circle cx={on ? 22 : 10} cy={10} r={6} fill={on ? '#fff' : color} />
        </Svg>
      );
    case 'arrowR':
      return (
        <Svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M5 12h14M13 6l6 6-6 6" />
        </Svg>
      );
    default:
      return null;
  }
}
