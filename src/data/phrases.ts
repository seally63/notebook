// Phrases repository. Phase 1 needs read access (to render phrase cards in entries).
// The full §12 create pipeline (translate + TTS) arrives in Phase 3; a minimal upsert
// is included for the dev seed.

import { exec, selectAll } from '../db/sqlite';
import type { PhraseRow } from '../db/schema';
import { getCurrentUserId } from './session';
import { newId } from '../lib/uuid';
import { nowIso } from '../lib/time';
import { triggerSync } from '../sync/runSync';

export async function getPhrase(id: string): Promise<PhraseRow | undefined> {
  const rows = await selectAll<PhraseRow>('SELECT * FROM phrases WHERE id = ? AND deleted = 0 LIMIT 1', [id]);
  return rows[0];
}

export async function listPhrases(): Promise<PhraseRow[]> {
  return selectAll<PhraseRow>('SELECT * FROM phrases WHERE deleted = 0 ORDER BY created_at DESC');
}

export async function insertPhrase(p: {
  id?: string;
  en: string;
  tgt?: string | null;
  tgt_romanised?: string | null;
  lang?: string | null;
  for_person?: string | null;
  register?: PhraseRow['register'];
}): Promise<string> {
  const id = p.id ?? newId();
  const now = nowIso();
  await exec(
    `INSERT OR REPLACE INTO phrases
       (id, user_id, en, tgt, tgt_romanised, register, note, lang, for_person, audio_ref,
        tgt_edited, pending_translation, pending_audio, created_at, updated_at, deleted, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 0, 0)`,
    [
      id,
      getCurrentUserId(),
      p.en,
      p.tgt ?? null,
      p.tgt_romanised ?? null,
      p.register ?? null,
      null,
      p.lang ?? null,
      p.for_person ?? null,
      null,
      now,
      now,
    ],
  );
  triggerSync('phrase-insert');
  return id;
}
