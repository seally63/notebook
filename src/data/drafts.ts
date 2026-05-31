// Drafts repository (§8). At most one open draft per (user_id, date) — enforced by a
// unique index. Drafts sync but never appear as journal rows; they surface only via
// the TODAY block. Committing turns a draft into an entry atomically.

import { exec, selectAll } from '../db/sqlite';
import type { BodyNode, DraftRow } from '../db/schema';
import { parseNodes, serializeNodes } from './body';
import { getCurrentUserId } from './session';
import { newId } from '../lib/uuid';
import { nowIso, todayDate } from '../lib/time';
import { triggerSync } from '../sync/runSync';

export type ParsedDraft = Omit<DraftRow, 'nodes'> & { nodes: BodyNode[] };

const parse = (r: DraftRow): ParsedDraft => ({ ...r, nodes: parseNodes(r.nodes as unknown as string) });

export async function getDraftForDate(date: string): Promise<ParsedDraft | undefined> {
  const rows = await selectAll<DraftRow>(
    'SELECT * FROM drafts WHERE date = ? AND deleted = 0 ORDER BY updated_at DESC LIMIT 1',
    [date],
  );
  return rows[0] ? parse(rows[0]) : undefined;
}

export const getTodayDraft = (): Promise<ParsedDraft | undefined> => getDraftForDate(todayDate());

/** insert-or-update the single draft for a date; returns its id */
export async function saveDraft(date: string, nodes: BodyNode[]): Promise<string> {
  const now = nowIso();
  const existing = await getDraftForDate(date);
  if (existing) {
    await exec('UPDATE drafts SET nodes = ?, saved_at = ?, updated_at = ?, synced = 0 WHERE id = ?', [
      serializeNodes(nodes),
      now,
      now,
      existing.id,
    ]);
    triggerSync('draft-save');
    return existing.id;
  }
  const id = newId();
  await exec(
    `INSERT INTO drafts (id, user_id, date, nodes, saved_at, created_at, updated_at, deleted, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)`,
    [id, getCurrentUserId(), date, serializeNodes(nodes), now, now, now],
  );
  triggerSync('draft-save');
  return id;
}

export async function deleteDraft(id: string): Promise<void> {
  await exec('UPDATE drafts SET deleted = 1, updated_at = ?, synced = 0 WHERE id = ?', [nowIso(), id]);
  triggerSync('draft-delete');
}

/** commit a draft → a new entry, soft-deleting the draft, atomically. returns entry id */
export async function commitDraft(draftId: string, date: string, nodes: BodyNode[]): Promise<string> {
  const entryId = newId();
  const now = nowIso();
  await exec('BEGIN');
  try {
    await exec(
      `INSERT INTO entries (id, user_id, date, nodes, created_at, updated_at, deleted, synced)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
      [entryId, getCurrentUserId(), date, serializeNodes(nodes), now, now],
    );
    await exec('UPDATE drafts SET deleted = 1, updated_at = ?, synced = 0 WHERE id = ?', [now, draftId]);
    await exec('COMMIT');
  } catch (e) {
    await exec('ROLLBACK');
    throw e;
  }
  triggerSync('draft-commit');
  return entryId;
}
