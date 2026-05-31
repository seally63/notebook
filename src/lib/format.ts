// Display formatting for dates/times in the Carbon mono style.

const WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON_FULL = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];
const MON_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' -> local Date (no TZ surprises) */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export const formatTime = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const timeFromIso = (iso: string): string => formatTime(new Date(iso));

/** "MAY · 2026" */
export const monthYearLabel = (d: Date = new Date()): string => `${MON_FULL[d.getMonth()]} · ${d.getFullYear()}`;

/** compose/entry header: "2026.05.27 — WED — 21:14" */
export function composeStamp(dateStr: string, time: string): string {
  const d = parseDate(dateStr);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} — ${WD[d.getDay()]} — ${time}`;
}

/** TODAY block: "27.05.2026 — WED · 21:14" */
export function todayStamp(dateStr: string, time?: string): string {
  const d = parseDate(dateStr);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} — ${WD[d.getDay()]}${time ? ` · ${time}` : ''}`;
}

/** past-entry row date column */
export function rowDate(dateStr: string): { day: string; mon: string; wd: string } {
  const d = parseDate(dateStr);
  return { day: pad(d.getDate()), mon: MON_ABBR[d.getMonth()], wd: WD[d.getDay()] };
}

/** "27 May" — the People list / last-mention label. Accepts an ISO timestamp or
 *  a YYYY-MM-DD date string; null/empty → null. */
export function dayMonthLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = iso.length <= 10 ? parseDate(iso) : new Date(iso);
  if (isNaN(d.getTime())) return null;
  const m = MON_ABBR[d.getMonth()]; // 'MAY'
  return `${d.getDate()} ${m[0]}${m.slice(1).toLowerCase()}`; // '27 May'
}
