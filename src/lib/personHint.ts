// Disambiguation hint for a person row (picker + People list). Shows the person's
// context when set; otherwise, ONLY when their name collides with another in the list,
// falls back to a distinguishing line so two same-named people are never identical:
//   last mentioned → "last seen 27 May", else → "added 31 May".

import type { PersonRow } from '../db/schema';
import { dayMonthLabel } from './format';

export function duplicateNameSet(people: PersonRow[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of people) {
    const k = p.name.trim().toLowerCase();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const dup = new Set<string>();
  for (const [k, n] of counts) if (n > 1) dup.add(k);
  return dup;
}

export function personHint(p: PersonRow, isDuplicate: boolean): string | null {
  if (p.context && p.context.trim()) return p.context.trim();
  if (!isDuplicate) return null;
  if (p.last_mention_at) return `last seen ${dayMonthLabel(p.last_mention_at) ?? ''}`.trim();
  return `added ${dayMonthLabel(p.created_at) ?? ''}`.trim();
}
