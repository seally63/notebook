// Entries repository — committed journal entries (local-first; every write marks
// synced=0 and kicks a background sync).

import { exec, selectAll } from '../db/sqlite';
import type { BodyNode, EntryRow } from '../db/schema';
import { parseNodes, serializeNodes, mentionIds } from './body';
import { getCurrentUserId } from './session';
import { recomputeLastMention } from './people';
import { newId } from '../lib/uuid';
import { nowIso } from '../lib/time';
import { triggerSync } from '../sync/runSync';

export type ParsedEntry = Omit<EntryRow, 'nodes'> & { nodes: BodyNode[] };

const parse = (r: EntryRow): ParsedEntry => ({ ...r, nodes: parseNodes(r.nodes as unknown as string) });

export async function listEntries(limit = 60): Promise<ParsedEntry[]> {
  const rows = await selectAll<EntryRow>(
    'SELECT * FROM entries WHERE deleted = 0 ORDER BY date DESC, created_at DESC LIMIT ?',
    [limit],
  );
  return rows.map(parse);
}

export async function getEntry(id: string): Promise<ParsedEntry | undefined> {
  const rows = await selectAll<EntryRow>('SELECT * FROM entries WHERE id = ? AND deleted = 0 LIMIT 1', [id]);
  return rows[0] ? parse(rows[0]) : undefined;
}

/** today's (or any date's) committed entry, if one exists */
export async function getEntryForDate(date: string): Promise<ParsedEntry | undefined> {
  const rows = await selectAll<EntryRow>(
    'SELECT * FROM entries WHERE date = ? AND deleted = 0 ORDER BY created_at DESC LIMIT 1',
    [date],
  );
  return rows[0] ? parse(rows[0]) : undefined;
}

/** entries that mention a person (People-detail "IN THE JOURNAL"). Scans the nodes
 *  JSON for the person node; cheap at local scale. */
export async function entriesMentioning(personId: string): Promise<ParsedEntry[]> {
  const rows = await selectAll<EntryRow>(
    `SELECT * FROM entries WHERE deleted = 0 AND nodes LIKE ? ORDER BY date DESC, created_at DESC`,
    [`%"person_id":"${personId}"%`],
  );
  return rows.map(parse);
}

/** 1-based chronological position of an entry (for the "ENTRY · 0NN" label) */
export async function entryOrdinal(id: string): Promise<number> {
  const rows = await selectAll<{ n: number }>(
    `SELECT COUNT(*) AS n FROM entries
     WHERE deleted = 0 AND created_at <= (SELECT created_at FROM entries WHERE id = ?)`,
    [id],
  );
  return Number(rows[0]?.n ?? 1);
}

export async function createEntry(date: string, nodes: BodyNode[]): Promise<string> {
  const id = newId();
  const now = nowIso();
  await exec(
    `INSERT INTO entries (id, user_id, date, nodes, created_at, updated_at, deleted, synced)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
    [id, getCurrentUserId(), date, serializeNodes(nodes), now, now],
  );
  triggerSync('entry-create');
  await recomputeLastMention(mentionIds(nodes));
  return id;
}

export async function updateEntry(id: string, nodes: BodyNode[]): Promise<void> {
  const prev = await getEntry(id); // capture old mentions so a removed person is re-evaluated
  await exec('UPDATE entries SET nodes = ?, updated_at = ?, synced = 0 WHERE id = ?', [
    serializeNodes(nodes),
    nowIso(),
    id,
  ]);
  triggerSync('entry-update');
  await recomputeLastMention([...mentionIds(prev?.nodes ?? []), ...mentionIds(nodes)]);
}
