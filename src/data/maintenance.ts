// Settings · DATA actions (§ Settings).
//   exportAllEntries() — render every entry to Markdown, write to a cache file, and open
//     the OS share sheet (save to Files, send, etc.). Uses RN Share + react-native-fs (no
//     new dependency).
//   deleteNotebook() — wipe the on-device database (all local rows). If signed in, the
//     cloud copy is untouched; this is a LOCAL reset (the caller warns about that).

import { Share } from 'react-native';
import { CachesDirectoryPath, writeFile } from '@dr.pogodin/react-native-fs';
import { exec } from '../db/sqlite';
import { SYNC_TABLES } from '../db/schema';
import { listEntries } from './entries';
import { listPeople } from './people';
import { listPhrases } from './phrases';
import { previewText } from './body';
import { parseDate } from '../lib/format';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function longDate(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}

/** Build a Markdown document of all entries (newest first) with inline [name] refs and
 *  phrase lines, then share it. Returns the number of entries exported. */
export async function exportAllEntries(): Promise<number> {
  const [entries, people, phrases] = await Promise.all([listEntries(1000), listPeople(), listPhrases()]);
  const nameFor = (id: string) => people.find((p) => p.id === id)?.name;
  const phraseFor = (id: string) => phrases.find((p) => p.id === id);

  const lines: string[] = ['# Notebook — entries', ''];
  for (const e of entries) {
    lines.push(`## ${longDate(e.date)}`, '');
    lines.push(previewText(e.nodes, nameFor) || '_(empty)_');
    // append any phrases attached to the entry
    for (const n of e.nodes) {
      if (n.type === 'phrase') {
        const ph = phraseFor(n.phrase_id);
        if (ph) lines.push('', `> **${ph.en}** — ${ph.tgt ?? '…'}${ph.tgt_romanised ? ` (${ph.tgt_romanised})` : ''}`);
      }
    }
    lines.push('', '---', '');
  }

  const md = lines.join('\n');
  const path = `${CachesDirectoryPath}/notebook-export.md`;
  await writeFile(path, md, 'utf8');
  await Share.share({ url: `file://${path}`, title: 'Notebook export', message: 'Notebook export' });
  return entries.length;
}

/** Hard-wipe all local data (every syncable table). Local only — does not touch the cloud
 *  copy if signed in. The DB schema/migrations stay; rows are removed. */
export async function deleteNotebook(): Promise<void> {
  for (const table of SYNC_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    await exec(`DELETE FROM ${table}`);
  }
}
