// Lately data (§ Lately) — the relational overview, assembled from the local DB:
//   1. calendar — the last 4 weeks (Mon-first), each day marked if it has a committed
//      entry, with a "weight" (0..1) scaled by entry length for the dot size.
//   2. carryOvers — forward-looking notes-to-self from recent entries (heuristic).
//   3. quiet — people not mentioned in N+ days (default 14), softly surfaced.

import { listEntries, type ParsedEntry } from './entries';
import { listPeople } from './people';
import { mentionIds } from './body';
import { extractCarryOvers, type CarryOver } from './carryover';
import { todayDate } from '../lib/time';
import type { PersonRow } from '../db/schema';

export interface CalDay {
  date: string; // YYYY-MM-DD
  d: number; // day of month
  inMonth: boolean; // belongs to the displayed reference month (for dimming)
  has: boolean; // has a committed entry
  weight: number; // 0..1 dot size
  isToday: boolean;
  entryId: string | null; // first entry that day (multi-entry days → day-filtered later)
}

export interface QuietPerson {
  person: PersonRow;
  daysSince: number;
  lastNote: string | null;
}

export interface LatelyData {
  weeks: CalDay[][]; // 4 rows × 7 days, Monday-first
  carryOvers: (CarryOver & { personName: string | null })[];
  quiet: QuietPerson[];
}

const DAY_MS = 86_400_000;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `d` (local). */
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}

/** plain text of an entry (person tokens → bare names, phrases dropped) for scanning. */
function plainText(e: ParsedEntry, nameFor: (id: string) => string | undefined): string {
  return e.nodes
    .map((n) => {
      if (n.type === 'text') return n.text;
      if (n.type === 'person') return nameFor(n.person_id) ?? '';
      return '';
    })
    .join('')
    .replace(/[ \t]+/g, ' ');
}

export async function getLatelyData(quietThresholdDays = 14): Promise<LatelyData> {
  const [entries, people] = await Promise.all([listEntries(400), listPeople()]);
  const nameFor = (id: string) => people.find((p) => p.id === id)?.name;
  const today = todayDate();

  // ── 1. calendar: 4 weeks ending on the current week (Mon-first) ──────────
  const byDate = new Map<string, ParsedEntry[]>();
  for (const e of entries) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  const refMonth = new Date().getMonth();
  const start = mondayOf(new Date(Date.now() - 21 * DAY_MS)); // 3 weeks back → 4 rows incl. this week
  const weeks: CalDay[][] = [];
  for (let w = 0; w < 4; w++) {
    const row: CalDay[] = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(start.getTime() + (w * 7 + i) * DAY_MS);
      const date = ymd(cur);
      const dayEntries = byDate.get(date) ?? [];
      const has = dayEntries.length > 0;
      // weight by longest entry's text length (clamped) → dot size signal
      const maxLen = has ? Math.max(...dayEntries.map((e) => plainText(e, nameFor).length)) : 0;
      row.push({
        date,
        d: cur.getDate(),
        inMonth: cur.getMonth() === refMonth,
        has,
        weight: has ? Math.min(1, 0.3 + maxLen / 280) : 0,
        isToday: date === today,
        entryId: has ? dayEntries[0].id : null,
      });
    }
    weeks.push(row);
  }

  // ── 2. carry-overs from recent entries (newest first) ───────────────────
  const recent = entries.slice(0, 40);
  const carryRaw = extractCarryOvers(
    recent.map((e) => ({
      entryId: e.id,
      date: e.date,
      personId: mentionIds(e.nodes)[0] ?? null,
      text: plainText(e, nameFor),
    })),
  );
  const carryOvers = carryRaw.map((c) => ({ ...c, personName: c.personId ? nameFor(c.personId) ?? null : null }));

  // ── 3. quiet people: not mentioned in N+ days ───────────────────────────
  const now = Date.now();
  const quiet: QuietPerson[] = [];
  for (const p of people) {
    if (!p.last_mention_at) continue; // never mentioned → not "gone quiet", just new
    const last = new Date(p.last_mention_at);
    if (isNaN(last.getTime())) continue;
    const daysSince = Math.floor((now - last.getTime()) / DAY_MS);
    if (daysSince >= quietThresholdDays) {
      // last note = the carry-over text if any, else the snippet of their latest entry
      const note = carryOvers.find((c) => c.personId === p.id)?.text ?? null;
      quiet.push({ person: p, daysSince, lastNote: note });
    }
  }
  quiet.sort((a, b) => b.daysSince - a.daysSince);

  return { weeks, carryOvers, quiet };
}
