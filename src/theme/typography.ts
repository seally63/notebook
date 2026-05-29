// Recurring text roles, precomputed from the Carbon tokens.
// letterSpacing is resolved to points here (RN units). Mono labels are uppercase with
// positive tracking; body/display use tight negative tracking (README + §3).

import { type TextStyle } from 'react-native';
import { colors, fonts, type, tracking, trackingEm } from './tokens';

export const text = {
  hero: {
    fontFamily: fonts.display.semibold,
    fontWeight: '600',
    fontSize: type.hero,
    letterSpacing: tracking(type.hero, trackingEm.tight),
    color: colors.text,
  } as TextStyle,

  title: {
    fontFamily: fonts.display.semibold,
    fontWeight: '600',
    fontSize: type.title,
    letterSpacing: tracking(type.title, trackingEm.tight),
    color: colors.text,
  } as TextStyle,

  lead: {
    fontFamily: fonts.body.regular,
    fontWeight: '400',
    fontSize: type.lead,
    letterSpacing: tracking(type.lead, trackingEm.normal),
    color: colors.text,
  } as TextStyle,

  body: {
    fontFamily: fonts.body.regular,
    fontWeight: '400',
    fontSize: type.body,
    letterSpacing: tracking(type.body, trackingEm.normal),
    color: colors.text,
  } as TextStyle,

  // The dock leg label / ScreenHeader title: mono 10.5, uppercase, 0.12em, muted.
  monoLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10.5,
    letterSpacing: tracking(10.5, trackingEm.monoLabel),
    textTransform: 'uppercase',
    color: colors.muted,
  } as TextStyle,

  // Field labels (auth, forms): mono 10, 0.14em.
  monoFieldLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: type.micro,
    letterSpacing: tracking(type.micro, trackingEm.monoWide),
    textTransform: 'uppercase',
    color: colors.muted,
  } as TextStyle,

  // CTA button labels (BEGIN A NEW NOTEBOOK, SAVE…): mono 11, 0.18em.
  monoButton: {
    fontFamily: fonts.mono.regular,
    fontSize: type.label,
    letterSpacing: tracking(type.label, trackingEm.monoButton),
    textTransform: 'uppercase',
  } as TextStyle,

  // Smallest mono annotation (status footers, NO TRACKERS · LOCAL FIRST…).
  monoMicro: {
    fontFamily: fonts.mono.regular,
    fontSize: type.micro,
    letterSpacing: tracking(type.micro, trackingEm.monoLabel),
    textTransform: 'uppercase',
    color: colors.muted,
  } as TextStyle,
} as const;

export type TextRole = keyof typeof text;
