// Resolve the person/phrase rows referenced by a set of bodies, so the read view can
// render synchronously. Also pulls in the people referenced by phrase.for_person.

import type { BodyNode, PersonRow, PhraseRow } from '../db/schema';
import { getPerson } from './people';
import { getPhrase } from './phrases';

export interface ResolvedRefs {
  people: Record<string, PersonRow>;
  phrases: Record<string, PhraseRow>;
}

export async function resolveRefs(bodies: BodyNode[][]): Promise<ResolvedRefs> {
  const personIds = new Set<string>();
  const phraseIds = new Set<string>();

  for (const nodes of bodies) {
    for (const n of nodes) {
      if (n.type === 'person') personIds.add(n.person_id);
      else if (n.type === 'phrase') phraseIds.add(n.phrase_id);
    }
  }

  const phrases: Record<string, PhraseRow> = {};
  for (const id of phraseIds) {
    const ph = await getPhrase(id);
    if (ph) {
      phrases[id] = ph;
      if (ph.for_person) personIds.add(ph.for_person);
    }
  }

  const people: Record<string, PersonRow> = {};
  for (const id of personIds) {
    const p = await getPerson(id);
    if (p) people[id] = p;
  }

  return { people, phrases };
}
