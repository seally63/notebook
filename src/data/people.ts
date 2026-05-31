// People repository. Phase 1 needs read access (to resolve inline [name] refs and
// phrase tags in the read view). Create/quick-add + last_mention bookkeeping arrive
// in Phase 2; a minimal upsert is included here for the dev seed.

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

export async function insertPerson(p: {
  id?: string;
  name: string;
  context?: string | null;
  lang?: string | null;
  initial?: string | null;
}): Promise<string> {
  const id = p.id ?? newId();
  const now = nowIso();
  const initial = p.initial ?? p.name.trim().charAt(0).toUpperCase();
  await exec(
    `INSERT OR REPLACE INTO people (id, user_id, name, context, initial, lang, last_mention_at, created_at, updated_at, deleted, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    [id, getCurrentUserId(), p.name, p.context ?? null, initial, p.lang ?? null, null, now, now],
  );
  triggerSync('person-insert');
  return id;
}
