// Pure tests for the carry-over heuristic (src/data/carryover.ts).

import { isCarrySentence, extractCarryOvers, type CarryCandidate } from '../src/data/carryover';

describe('isCarrySentence', () => {
  it('flags forward-looking notes', () => {
    expect(isCarrySentence('Ask about Hania next Wednesday')).toBe(true);
    expect(isCarrySentence("Don't forget to bring the ladder back")).toBe(true);
    expect(isCarrySentence('Remember her mother is unwell')).toBe(true);
    expect(isCarrySentence('I should call dad this weekend')).toBe(true);
  });

  it('ignores plain past-tense narration', () => {
    expect(isCarrySentence('We had coffee and it was nice')).toBe(false);
    expect(isCarrySentence('Met Marek at the warehouse today')).toBe(false);
  });

  it('rejects too-short or too-long fragments', () => {
    expect(isCarrySentence('ask')).toBe(false); // < 6 chars
    expect(isCarrySentence('ask ' + 'x'.repeat(200))).toBe(false); // > 160 chars
  });

  it('matches cues as whole words only (no substring false-positives)', () => {
    expect(isCarrySentence('The basket was full of apples')).toBe(false); // "ask" inside "basket"
    expect(isCarrySentence('He is a tasker by trade honestly')).toBe(false); // "ask" inside "tasker"
  });
});

describe('extractCarryOvers', () => {
  const mk = (entryId: string, date: string, personId: string | null, text: string): CarryCandidate => ({
    entryId,
    date,
    personId,
    text,
  });

  it('pulls the first forward-looking sentence per entry, attributed to the person', () => {
    const cands = [
      mk('e1', '2026-05-27', 'marek', 'Met Marek today. Ask about Hania next Wednesday. He seemed tired.'),
      mk('e2', '2026-05-26', 'olena', 'Coffee with Olena. She is reading a lot lately.'), // no cue
      mk('e3', '2026-05-24', 'dad', 'Dad called. Remember to ask about his back.'),
    ];
    const out = extractCarryOvers(cands);
    expect(out).toEqual([
      { entryId: 'e1', date: '2026-05-27', personId: 'marek', text: 'Ask about Hania next Wednesday.' },
      { entryId: 'e3', date: '2026-05-24', personId: 'dad', text: 'Remember to ask about his back.' },
    ]);
  });

  it('respects the limit', () => {
    const cands = Array.from({ length: 5 }, (_, i) => mk(`e${i}`, '2026-05-20', null, 'I should follow up soon.'));
    expect(extractCarryOvers(cands, 2)).toHaveLength(2);
  });

  it('returns empty when nothing looks forward-looking', () => {
    expect(extractCarryOvers([mk('e1', '2026-05-20', null, 'Just a normal day, nothing special.')])).toEqual([]);
  });
});
