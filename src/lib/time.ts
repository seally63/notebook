// Time helpers. updated_at drives last-write-wins conflict resolution (sync engine),
// so everything is stored as ISO-8601 UTC strings for lexicographic comparability.

export const nowIso = (): string => new Date().toISOString();

/** today's date as YYYY-MM-DD (local) — the key for one-draft-per-day (§8.1). */
export const todayDate = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
