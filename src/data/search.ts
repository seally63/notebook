// Universal search (§ Search) — query across people, entries, and phrases from the local
// DB. Case-insensitive substring match; entries also match on the names of people they
// mention. Returns grouped, capped results for the live-filter UI.

import { listEntries, type ParsedEntry } from './entries';
import { listPeople } from './people';
import { listPhrases } from './phrases';
import { previewText } from './body';
import type { PersonRow, PhraseRow } from '../db/schema';

export interface SearchResults {
  people: PersonRow[];
  entries: { entry: ParsedEntry; preview: string }[];
  phrases: PhraseRow[];
  counts: { entries: number; people: number; phrases: number }; // library totals (BROWSE chips)
}

export async function searchAll(query: string, perGroup = 12): Promise<SearchResults> {
  const [people, entries, phrases] = await Promise.all([listPeople(), listEntries(400), listPhrases()]);
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  const nameFor = (id: string) => nameById.get(id);
  const counts = { entries: entries.length, people: people.length, phrases: phrases.length };

  const q = query.trim().toLowerCase();
  if (!q) return { people: [], entries: [], phrases: [], counts };

  const peopleHits = people.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.context ?? '').toLowerCase().includes(q),
  );

  const entryHits = entries
    .map((e) => ({ entry: e, preview: previewText(e.nodes, nameFor) }))
    .filter(({ entry, preview }) => {
      if (preview.toLowerCase().includes(q)) return true;
      // also match on mentioned people's names
      return entry.nodes.some((n) => n.type === 'person' && (nameById.get(n.person_id) ?? '').toLowerCase().includes(q));
    });

  const phraseHits = phrases.filter((p) => {
    if (p.en.toLowerCase().includes(q)) return true;
    if ((p.tgt ?? '').toLowerCase().includes(q)) return true;
    if (p.for_person && (nameById.get(p.for_person) ?? '').toLowerCase().includes(q)) return true;
    return false;
  });

  return {
    people: peopleHits.slice(0, perGroup),
    entries: entryHits.slice(0, perGroup),
    phrases: phraseHits.slice(0, perGroup),
    counts,
  };
}
