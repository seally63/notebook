// Carry-over extraction (§ Lately). The journal earns the user a "pre-flight check"
// before the next conversation: forward-looking notes-to-self they left in past entries
// ("ask about Hania next Wednesday"), attributed to the person that entry is about.
//
// This module is PURE (no RN / DB) so the heuristic is unit-testable. The caller feeds it
// plain entry text + the people mentioned; it returns the carry-over lines.

export interface CarryCandidate {
  text: string; // the source entry's plain text (person tokens already flattened to names)
  personId: string | null; // the primary person the entry is about (first mention), or null
  date: string; // YYYY-MM-DD
  entryId: string;
}

export interface CarryOver {
  entryId: string;
  date: string;
  personId: string | null;
  text: string; // the forward-looking sentence
}

// Forward-looking cues. Matched case-insensitively as whole words at/after a sentence
// start. Deliberately conservative — better to miss than to surface noise.
const CUES = [
  'ask',
  'remember',
  'remind',
  "don't forget",
  'dont forget',
  'next time',
  'next week',
  'next month',
  'bring',
  'tell',
  'follow up',
  'check in',
  'check on',
  'send',
  'call',
  'text',
  'reply',
  'reach out',
  'mention',
  'want to ask',
  'need to',
  'should',
];

const cueRe = new RegExp(`\\b(${CUES.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');

/** split text into sentence-ish fragments (on ., !, ?, newlines). */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Does this sentence read like a note-to-self / future intention? */
export function isCarrySentence(sentence: string): boolean {
  const s = sentence.trim();
  if (s.length < 6 || s.length > 160) return false; // too short to be a note / too long to be one line
  return cueRe.test(s);
}

/** Extract carry-over notes from a set of entries. At most one note per entry (the first
 *  forward-looking sentence), newest first. `limit` caps the result. */
export function extractCarryOvers(candidates: CarryCandidate[], limit = 8): CarryOver[] {
  const out: CarryOver[] = [];
  for (const c of candidates) {
    const hit = sentences(c.text).find(isCarrySentence);
    if (hit) out.push({ entryId: c.entryId, date: c.date, personId: c.personId, text: hit });
    if (out.length >= limit) break;
  }
  return out;
}
