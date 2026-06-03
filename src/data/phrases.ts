// Phrases repository (§12). The user types ONLY the English; the target translation and
// audio are generated automatically (translate-phrase + synthesise-phrase Edge Funcs).
// Creation is non-blocking: the row is written immediately with pending_translation /
// pending_audio flags, then resolvePhrase() fills tgt + audio_ref in the background and
// can be retried (offline / service failure). Every write marks synced=0 + triggers sync.

import { exec, selectAll } from '../db/sqlite';
import type { PhraseRow } from '../db/schema';
import { getCurrentUserId } from './session';
import { getPerson } from './people';
import { newId } from '../lib/uuid';
import { nowIso } from '../lib/time';
import { triggerSync } from '../sync/runSync';
import { translatePhrase } from '../services/translate';
import { synthesisePhrase, ttsSupportsLang } from '../services/tts';

// ── live-update bus ──────────────────────────────────────────────────────────
// Background resolve (translate/TTS) fills phrases asynchronously; screens subscribe so
// the inline reveal / cards update in place without leaving the entry.
const phraseListeners = new Set<() => void>();
export function subscribePhrases(fn: () => void): () => void {
  phraseListeners.add(fn);
  return () => {
    phraseListeners.delete(fn);
  };
}
function notifyPhrasesChanged(): void {
  for (const fn of phraseListeners) fn();
}

export async function getPhrase(id: string): Promise<PhraseRow | undefined> {
  const rows = await selectAll<PhraseRow>('SELECT * FROM phrases WHERE id = ? AND deleted = 0 LIMIT 1', [id]);
  return rows[0];
}

export async function listPhrases(): Promise<PhraseRow[]> {
  return selectAll<PhraseRow>('SELECT * FROM phrases WHERE deleted = 0 ORDER BY created_at DESC');
}

/** phrases tagged to a person (People-detail PHRASES section). */
export async function listPhrasesForPerson(personId: string): Promise<PhraseRow[]> {
  return selectAll<PhraseRow>(
    'SELECT * FROM phrases WHERE for_person = ? AND deleted = 0 ORDER BY created_at DESC',
    [personId],
  );
}

/** 1-based creation order (for a "PHRASE · NNN" style label if needed). */
export async function phraseOrdinal(id: string): Promise<number> {
  const rows = await selectAll<{ n: number }>(
    `SELECT COUNT(*) AS n FROM phrases
       WHERE deleted = 0 AND created_at <= (SELECT created_at FROM phrases WHERE id = ?)`,
    [id],
  );
  return Number(rows[0]?.n ?? 1);
}

/**
 * Create a phrase from English (§12). Writes the row immediately with pending flags, then
 * resolves translation + audio in the background. Returns the new id right away so the
 * UI can navigate; pass an onResolved callback to refresh once filled.
 */
export async function createPhrase(input: {
  id?: string; // when created from a compose/entry stub, reuse the stub's local_id so the
  // in-text stub resolves by a DB lookup (no fragile navigation params) — see §5.
  en: string;
  lang: string | null; // BCP-47; inferred from for_person by the caller
  forPerson?: string | null;
  tgt?: string | null; // manual override (offline path) — skips auto-translate
  tgtEdited?: boolean;
}): Promise<string> {
  const id = input.id ?? newId();
  const now = nowIso();
  const manual = !!input.tgt && !!input.tgtEdited;
  const pendingTranslation = manual ? 0 : 1;
  const pendingAudio = input.lang && ttsSupportsLang(input.lang) ? 1 : 0;

  await exec(
    `INSERT INTO phrases
       (id, user_id, en, tgt, tgt_romanised, register, note, lang, for_person, audio_ref,
        variants, tgt_edited, pending_translation, pending_audio, created_at, updated_at, deleted, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    [
      id,
      getCurrentUserId(),
      input.en.trim(),
      input.tgt ?? null,
      null,
      null,
      null,
      input.lang ?? null,
      input.forPerson ?? null,
      null,
      '[]',
      input.tgtEdited ? 1 : 0,
      pendingTranslation,
      pendingAudio,
      now,
      now,
    ],
  );
  triggerSync('phrase-create');
  notifyPhrasesChanged();
  // fire-and-forget resolve (translation + audio)
  void resolvePhrase(id);
  return id;
}

/** Update the manual target text; marks tgt_edited so re-translation won't clobber it
 *  (§12.2), and re-queues audio for the new text. */
export async function setPhraseTarget(id: string, tgt: string): Promise<void> {
  const now = nowIso();
  await exec(
    `UPDATE phrases SET tgt = ?, tgt_edited = 1, variants = '[]', pending_translation = 0,
       pending_audio = 1, audio_ref = NULL, updated_at = ?, synced = 0 WHERE id = ?`,
    [tgt.trim(), now, id],
  );
  triggerSync('phrase-edit');
  notifyPhrasesChanged();
  void resolvePhrase(id);
}

export async function deletePhrase(id: string): Promise<void> {
  await exec('UPDATE phrases SET deleted = 1, updated_at = ?, synced = 0 WHERE id = ?', [nowIso(), id]);
  triggerSync('phrase-delete');
  notifyPhrasesChanged();
}

/**
 * Fill in translation + audio for a phrase that still has pending flags. Idempotent and
 * safe to call repeatedly (startup, on reconnect, after create). Returns true if it made
 * progress.
 */
export async function resolvePhrase(id: string): Promise<boolean> {
  const p = await getPhrase(id);
  if (!p) return false;
  let progressed = false;

  // 1) translation
  if (p.pending_translation && !p.tgt_edited && p.lang) {
    let ctx: string | null = null;
    if (p.for_person) {
      const person = await getPerson(p.for_person);
      if (person) ctx = [person.name, person.context].filter(Boolean).join(' · ');
    }
    const res = await translatePhrase({ en: p.en, targetLang: p.lang, forPersonContext: ctx });
    if (res) {
      await exec(
        `UPDATE phrases SET tgt = ?, tgt_romanised = ?, register = ?, note = ?, variants = ?,
           pending_translation = 0, updated_at = ?, synced = 0 WHERE id = ?`,
        [res.tgt, res.tgt_romanised, res.register, res.note, JSON.stringify(res.variants ?? []), nowIso(), id],
      );
      triggerSync('phrase-translated');
      notifyPhrasesChanged();
      progressed = true;
    }
  }

  // 2) audio (needs a target + supported lang)
  const cur = await getPhrase(id);
  if (cur && cur.pending_audio && cur.tgt && cur.lang && ttsSupportsLang(cur.lang)) {
    const synth = await synthesisePhrase({ tgt: cur.tgt, lang: cur.lang });
    if (synth) {
      await exec(
        `UPDATE phrases SET audio_ref = ?, pending_audio = 0, updated_at = ?, synced = 0 WHERE id = ?`,
        [synth.audioRef, nowIso(), id],
      );
      triggerSync('phrase-audio');
      notifyPhrasesChanged();
      progressed = true;
    }
  }
  return progressed;
}

/** Resolve every phrase that still has a pending flag (called on startup / reconnect). */
export async function resolvePendingPhrases(): Promise<void> {
  const rows = await selectAll<PhraseRow>(
    'SELECT id FROM phrases WHERE deleted = 0 AND (pending_translation = 1 OR pending_audio = 1)',
  );
  for (const r of rows) {
    // sequential to avoid hammering the Edge Functions
    // eslint-disable-next-line no-await-in-loop
    await resolvePhrase(r.id);
  }
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
        variants, tgt_edited, pending_translation, pending_audio, created_at, updated_at, deleted, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', 0, 0, 0, ?, ?, 0, 0)`,
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
