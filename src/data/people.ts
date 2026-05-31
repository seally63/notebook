// People repository (local-first). Read access (resolve [name] refs), create/quick-add,
// inline create from the compose @ picker, edit, search, and last_mention bookkeeping.
// Every write marks synced=0 and kicks a background sync.

import { exec, selectAll } from '../db/sqlite';
import type { PersonRow } from '../db/schema';
import { getCurrentUserId } from './session';
import { newId } from '../lib/uuid';
import { nowIso } from '../lib/time';
import { triggerSync } from '../sync/runSync';

export async function getPerson(id: string): Promise<PersonRow | undefined> {
  const rows = await selectAll<PersonRow>('SELECT * FROM people WHERE id = ? AND deleted = 0 LIMIT 1', [id]);
  return rows[0];
}

export async function listPeople(): Promise<PersonRow[]> {
  return selectAll<PersonRow>('SELECT * FROM people WHERE deleted = 0 ORDER BY name COLLATE NOCASE ASC');
}

/** name/context substring filter for the @ picker + People search. Empty → all. */
export async function searchPeople(query: string): Promise<PersonRow[]> {
  const q = query.trim().toLowerCase();
  if (!q) return listPeople();
  const like = `%${q}%`;
  return selectAll<PersonRow>(
    `SELECT * FROM people
       WHERE deleted = 0 AND (lower(name) LIKE ? OR lower(COALESCE(context,'')) LIKE ?)
       ORDER BY name COLLATE NOCASE ASC`,
    [like, like],
  );
}

/** 1-based creation order (for the "PERSON · 001" detail label). */
export async function personOrdinal(id: string): Promise<number> {
  const rows = await selectAll<{ n: number }>(
    `SELECT COUNT(*) AS n FROM people
       WHERE deleted = 0 AND created_at <= (SELECT created_at FROM people WHERE id = ?)`,
    [id],
  );
  return Number(rows[0]?.n ?? 1);
}

const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '·';

export async function insertPerson(p: {
  id?: string;
  name: string;
  context?: string | null;
  lang?: string | null;
  initial?: string | null;
}): Promise<string> {
  const id = p.id ?? newId();
  const now = nowIso();
  const initial = p.initial ?? initialOf(p.name);
  await exec(
    `INSERT OR REPLACE INTO people (id, user_id, name, context, initial, lang, last_mention_at, created_at, updated_at, deleted, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    [id, getCurrentUserId(), p.name.trim(), p.context ?? null, initial, p.lang ?? null, null, now, now],
  );
  triggerSync('person-insert');
  return id;
}

export async function updatePerson(
  id: string,
  fields: { name?: string; context?: string | null; lang?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const args: any[] = [];
  if (fields.name !== undefined) {
    sets.push('name = ?', 'initial = ?');
    args.push(fields.name.trim(), initialOf(fields.name));
  }
  if (fields.context !== undefined) {
    sets.push('context = ?');
    args.push(fields.context);
  }
  if (fields.lang !== undefined) {
    sets.push('lang = ?');
    args.push(fields.lang);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?', 'synced = 0');
  args.push(nowIso(), id);
  await exec(`UPDATE people SET ${sets.join(', ')} WHERE id = ?`, args);
  triggerSync('person-update');
}

/**
 * Recompute last_mention_at for the given people from the journal: the created_at of the
 * most recent (by date, then created_at) non-deleted entry that mentions them, or null if
 * none. Called after an entry is created/edited so the People list + Lately stay accurate.
 */
export async function recomputeLastMention(personIds: string[]): Promise<void> {
  const ids = Array.from(new Set(personIds)).filter(Boolean);
  if (ids.length === 0) return;
  const now = nowIso();
  for (const pid of ids) {
    const rows = await selectAll<{ created_at: string }>(
      `SELECT created_at FROM entries
         WHERE deleted = 0 AND nodes LIKE ?
         ORDER BY date DESC, created_at DESC LIMIT 1`,
      [`%"person_id":"${pid}"%`],
    );
    const last = rows[0]?.created_at ?? null;
    await exec('UPDATE people SET last_mention_at = ?, updated_at = ?, synced = 0 WHERE id = ?', [last, now, pid]);
  }
  triggerSync('last-mention');
}
