// Pure-function tests for the mention-aware editor model (src/data/mentions.ts).
// No RN, no DB — just the reconciler / converters / trigger detector.

import {
  Mention,
  nodesToInput,
  inputToNodes,
  reconcile,
  insertMention,
  findTrigger,
  mentionToken,
} from '../src/data/mentions';
import type { BodyNode } from '../src/db/schema';

const names: Record<string, string> = { p1: 'Marek', p2: 'Olena' };
const nameFor = (id: string) => names[id];

describe('mentionToken', () => {
  it('lowercases and brackets', () => {
    expect(mentionToken('Marek')).toBe('[marek]');
    expect(mentionToken('')).toBe('[…]');
  });
});

describe('nodesToInput / inputToNodes round-trip', () => {
  it('round-trips text + person nodes', () => {
    const nodes: BodyNode[] = [
      { type: 'text', text: 'saw ' },
      { type: 'person', person_id: 'p1' },
      { type: 'text', text: ' today' },
    ];
    const input = nodesToInput(nodes, nameFor);
    expect(input.text).toBe('saw [marek] today');
    expect(input.mentions).toEqual([{ start: 4, end: 11, personId: 'p1' }]);
    expect(inputToNodes(input)).toEqual(nodes);
  });

  it('drops empty text runs and preserves adjacency', () => {
    const input = { text: '[marek][olena]', mentions: [
      { start: 0, end: 7, personId: 'p1' },
      { start: 7, end: 14, personId: 'p2' },
    ] };
    expect(inputToNodes(input)).toEqual([
      { type: 'person', person_id: 'p1' },
      { type: 'person', person_id: 'p2' },
    ]);
  });

  it('ignores phrase nodes when loading', () => {
    const nodes: BodyNode[] = [
      { type: 'text', text: 'a' },
      { type: 'phrase', phrase_id: 'x' },
      { type: 'person', person_id: 'p1' },
    ];
    const input = nodesToInput(nodes, nameFor);
    expect(input.text).toBe('a[marek]');
    expect(input.mentions).toEqual([{ start: 1, end: 8, personId: 'p1' }]);
  });
});

describe('reconcile', () => {
  const base = '[marek] hello';
  const mentions: Mention[] = [{ start: 0, end: 7, personId: 'p1' }];

  it('shifts a mention when text is appended after it', () => {
    const r = reconcile(base, mentions, '[marek] hello!');
    expect(r.mentions).toEqual([{ start: 0, end: 7, personId: 'p1' }]);
  });

  it('shifts a mention forward when text is inserted before it', () => {
    const r = reconcile(base, mentions, 'hi [marek] hello');
    expect(r.mentions).toEqual([{ start: 3, end: 10, personId: 'p1' }]);
  });

  it('drops a mention when its interior is edited', () => {
    const r = reconcile(base, mentions, '[mrek] hello'); // deleted the 'a'
    expect(r.mentions).toEqual([]);
  });

  it('drops a mention when backspacing its trailing ]', () => {
    const r = reconcile(base, mentions, '[marek hello'); // removed ']'
    expect(r.mentions).toEqual([]);
  });

  it('keeps an untouched mention while another region changes', () => {
    const text = 'a [marek] b';
    const ms: Mention[] = [{ start: 2, end: 9, personId: 'p1' }];
    const r = reconcile(text, ms, 'aZ [marek] b'); // insert at index 1
    expect(r.mentions).toEqual([{ start: 3, end: 10, personId: 'p1' }]);
  });

  it('handles two mentions: edit between them shifts only the later', () => {
    const text = '[marek] x [olena]';
    const ms: Mention[] = [
      { start: 0, end: 7, personId: 'p1' },
      { start: 10, end: 17, personId: 'p2' },
    ];
    const r = reconcile(text, ms, '[marek] xy [olena]'); // insert 'y' at 9
    expect(r.mentions).toEqual([
      { start: 0, end: 7, personId: 'p1' },
      { start: 11, end: 18, personId: 'p2' },
    ]);
  });

  it('is a no-op when text is unchanged', () => {
    const r = reconcile(base, mentions, base);
    expect(r.mentions).toBe(mentions);
  });

  it('deleting a whole token range removes that mention only', () => {
    const text = '[marek] [olena]';
    const ms: Mention[] = [
      { start: 0, end: 7, personId: 'p1' },
      { start: 8, end: 15, personId: 'p2' },
    ];
    const r = reconcile(text, ms, ' [olena]'); // removed '[marek]'
    expect(r.mentions).toEqual([{ start: 1, end: 8, personId: 'p2' }]);
  });
});

describe('insertMention', () => {
  it('replaces an @query with a token + trailing space and returns caret', () => {
    // "saw @mar" → user picks Marek
    const state = { text: 'saw @mar', mentions: [] as Mention[] };
    const r = insertMention(state, 4, 8, 'p1', 'Marek');
    expect(r.text).toBe('saw [marek] ');
    expect(r.mentions).toEqual([{ start: 4, end: 11, personId: 'p1' }]);
    expect(r.caret).toBe(12);
  });

  it('inserts at a caret (from === to) without removing text', () => {
    const state = { text: 'hi ', mentions: [] as Mention[] };
    const r = insertMention(state, 3, 3, 'p2', 'Olena');
    expect(r.text).toBe('hi [olena] ');
    expect(r.caret).toBe(11);
  });

  it('shifts existing later mentions', () => {
    const state = { text: '@ [olena]', mentions: [{ start: 2, end: 9, personId: 'p2' }] };
    const r = insertMention(state, 0, 1, 'p1', 'Marek');
    // '@' (len1) → '[marek] ' (len8): delta +7
    expect(r.text).toBe('[marek]  [olena]');
    expect(r.mentions).toEqual([
      { start: 0, end: 7, personId: 'p1' },
      { start: 9, end: 16, personId: 'p2' },
    ]);
  });
});

describe('findTrigger', () => {
  it('detects @ at start of text', () => {
    expect(findTrigger('@mar', 4, [])).toEqual({ start: 0, query: 'mar' });
  });

  it('detects @ after a space', () => {
    expect(findTrigger('saw @ol', 7, [])).toEqual({ start: 4, query: 'ol' });
  });

  it('returns empty query right after typing @', () => {
    expect(findTrigger('hi @', 4, [])).toEqual({ start: 3, query: '' });
  });

  it('no trigger when @ is mid-word (email-like)', () => {
    expect(findTrigger('a@b', 3, [])).toBeNull();
  });

  it('no trigger when a space follows @ before the caret', () => {
    expect(findTrigger('@ mar', 5, [])).toBeNull();
  });

  it('no trigger when caret sits inside a finished token', () => {
    const ms: Mention[] = [{ start: 0, end: 7, personId: 'p1' }];
    expect(findTrigger('[marek] x', 9, ms)).toBeNull();
  });
});
