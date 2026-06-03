// Pure-function tests for the inline-token editor model (src/data/mentions.ts).
// No RN, no DB — just the reconciler / converters / trigger detector. Person AND phrase
// chips are inline tokens in one text stream.

import {
  Token,
  nodesToInput,
  inputToNodes,
  reconcile,
  insertPerson,
  insertPhrase,
  insertPhraseStub,
  resolvePhraseStubs,
  findTrigger,
  personToken,
  phraseToken,
} from '../src/data/mentions';
import type { BodyNode } from '../src/db/schema';

const names: Record<string, string> = { p1: 'Marek', p2: 'Olena' };
const ens: Record<string, string> = { ph1: 'How are you?' };
const nameFor = (id: string) => names[id];
const enFor = (id: string) => ens[id];

describe('chip text', () => {
  it('personToken lowercases + brackets; phraseToken guillemets', () => {
    expect(personToken('Marek')).toBe('[marek]');
    expect(personToken('')).toBe('[…]');
    expect(phraseToken('How are you?')).toBe('«How are you?»');
    expect(phraseToken('')).toBe('«new phrase»');
  });
});

describe('nodesToInput / inputToNodes round-trip', () => {
  it('round-trips text + person + phrase tokens in order', () => {
    const nodes: BodyNode[] = [
      { type: 'text', text: 'saw ' },
      { type: 'person', person_id: 'p1' },
      { type: 'text', text: ' and said ' },
      { type: 'phrase', phrase_id: 'ph1' },
    ];
    const input = nodesToInput(nodes, nameFor, enFor);
    expect(input.text).toBe('saw [marek] and said «How are you?»');
    expect(input.tokens.map((t) => t.kind)).toEqual(['person', 'phrase']);
    expect(inputToNodes(input)).toEqual(nodes);
  });

  it('round-trips a phrase_stub', () => {
    const nodes: BodyNode[] = [
      { type: 'text', text: 'x ' },
      { type: 'phrase_stub', local_id: 'loc1', en: 'hello' },
    ];
    const input = nodesToInput(nodes, nameFor, enFor);
    expect(input.text).toBe('x «hello»');
    expect(inputToNodes(input)).toEqual(nodes);
  });

  it('drops empty text runs and preserves adjacency', () => {
    const input = {
      text: '[marek]«How are you?»',
      tokens: [
        { start: 0, end: 7, kind: 'person', personId: 'p1' },
        { start: 7, end: 21, kind: 'phrase', phraseId: 'ph1', en: 'How are you?' },
      ] as Token[],
    };
    expect(inputToNodes(input)).toEqual([
      { type: 'person', person_id: 'p1' },
      { type: 'phrase', phrase_id: 'ph1' },
    ]);
  });
});

describe('reconcile', () => {
  const base = '[marek] hi «How are you?»';
  const tokens: Token[] = [
    { start: 0, end: 7, kind: 'person', personId: 'p1' },
    { start: 11, end: 25, kind: 'phrase', phraseId: 'ph1', en: 'How are you?' },
  ];

  it('appends after both tokens — both unchanged', () => {
    const r = reconcile(base, tokens, base + '!');
    expect(r.tokens).toEqual(tokens);
  });

  it('inserts before all tokens — both shift', () => {
    const r = reconcile(base, tokens, 'oh ' + base);
    expect(r.tokens).toEqual([
      { start: 3, end: 10, kind: 'person', personId: 'p1' },
      { start: 14, end: 28, kind: 'phrase', phraseId: 'ph1', en: 'How are you?' },
    ]);
  });

  it('editing a person chip interior drops only it', () => {
    const r = reconcile(base, tokens, '[mrek] hi «How are you?»'); // delete an 'a'
    expect(r.tokens.map((t) => t.kind)).toEqual(['phrase']);
  });

  it('deleting a whole phrase chip removes only it', () => {
    const r = reconcile(base, tokens, '[marek] hi '); // removed the «…»
    expect(r.tokens.map((t) => t.kind)).toEqual(['person']);
  });

  it('no-op when unchanged', () => {
    const r = reconcile(base, tokens, base);
    expect(r.tokens).toBe(tokens);
  });
});

describe('insertPerson / insertPhrase / insertPhraseStub', () => {
  it('insertPerson replaces @query with chip + space + caret', () => {
    const r = insertPerson({ text: 'saw @mar', tokens: [] }, 4, 8, 'p1', 'Marek');
    expect(r.text).toBe('saw [marek] ');
    expect(r.tokens).toEqual([{ start: 4, end: 11, kind: 'person', personId: 'p1' }]);
    expect(r.caret).toBe(12);
  });

  it('insertPhrase replaces #query with a guillemet chip', () => {
    const r = insertPhrase({ text: 'I said #cof', tokens: [] }, 7, 11, 'ph1', 'How are you?');
    expect(r.text).toBe('I said «How are you?» ');
    expect(r.tokens).toEqual([{ start: 7, end: 21, kind: 'phrase', phraseId: 'ph1', en: 'How are you?' }]);
    expect(r.caret).toBe(22);
  });

  it('insertPhraseStub inserts a stub token at the caret', () => {
    const r = insertPhraseStub({ text: 'note ', tokens: [] }, 5, 5, 'loc1', 'buy milk');
    expect(r.text).toBe('note «buy milk» ');
    expect(r.tokens).toEqual([{ start: 5, end: 15, kind: 'phrase_stub', localId: 'loc1', en: 'buy milk' }]);
  });

  it('insert shifts existing later tokens', () => {
    const state = { text: '@ [olena]', tokens: [{ start: 2, end: 9, kind: 'person', personId: 'p2' }] as Token[] };
    const r = insertPerson(state, 0, 1, 'p1', 'Marek');
    expect(r.text).toBe('[marek]  [olena]');
    expect(r.tokens).toEqual([
      { start: 0, end: 7, kind: 'person', personId: 'p1' },
      { start: 9, end: 16, kind: 'person', personId: 'p2' },
    ]);
  });
});

describe('resolvePhraseStubs (DB-lookup upgrade)', () => {
  it('upgrades a stub whose local_id now exists as a real phrase, re-rendering English', () => {
    // stub created with local_id 'ph1' and a placeholder English
    const state = insertPhraseStub({ text: 'x  y', tokens: [] }, 2, 2, 'ph1', 'how r u');
    // state.text === 'x «how r u»  y'
    const resolved = resolvePhraseStubs(state, (pid) => (pid === 'ph1' ? 'How are you?' : undefined));
    expect(resolved.text).toBe('x «How are you?»  y');
    expect(resolved.tokens).toEqual([{ start: 2, end: 16, kind: 'phrase', phraseId: 'ph1', en: 'How are you?' }]);
    expect(inputToNodes(resolved)).toEqual([
      { type: 'text', text: 'x ' },
      { type: 'phrase', phrase_id: 'ph1' },
      { type: 'text', text: '  y' },
    ]);
  });

  it('leaves a stub alone while its phrase does not exist yet (returns same ref)', () => {
    const state = insertPhraseStub({ text: '', tokens: [] }, 0, 0, 'ph9', 'pending');
    expect(resolvePhraseStubs(state, () => undefined)).toBe(state);
  });

  it('upgrades only the resolved stub among several tokens', () => {
    let s = insertPhraseStub({ text: '', tokens: [] }, 0, 0, 'a', 'one'); // «one»␣
    s = insertPhraseStub(s, s.caret, s.caret, 'b', 'two'); // «one» «two»␣
    const r = resolvePhraseStubs(s, (pid) => (pid === 'a' ? 'First' : undefined));
    const kinds = r.tokens.map((t) => `${t.kind}:${t.kind === 'phrase' ? t.phraseId : (t as any).localId}`);
    expect(kinds).toEqual(['phrase:a', 'phrase_stub:b']);
    expect(r.text).toBe('«First» «two» ');
  });
});

describe('findTrigger', () => {
  it('detects @ and # at start / after space', () => {
    expect(findTrigger('@mar', 4, [])).toEqual({ sigil: '@', start: 0, query: 'mar' });
    expect(findTrigger('I said #co', 10, [])).toEqual({ sigil: '#', start: 7, query: 'co' });
  });

  it('empty query right after the sigil', () => {
    expect(findTrigger('hi #', 4, [])).toEqual({ sigil: '#', start: 3, query: '' });
  });

  it('no trigger mid-word (email-like @)', () => {
    expect(findTrigger('a@b', 3, [])).toBeNull();
  });

  it('@ mention ALLOWS spaces (multi-word names like "Pani Krystyna")', () => {
    expect(findTrigger('@Pani Krys', 10, [])).toEqual({ sigil: '@', start: 0, query: 'Pani Krys' });
    expect(findTrigger('hi @ol', 6, [])).toEqual({ sigil: '@', start: 3, query: 'ol' });
  });

  it('# phrase ALLOWS spaces (multi-word) until a newline', () => {
    expect(findTrigger('#how are you', 12, [])).toEqual({ sigil: '#', start: 0, query: 'how are you' });
    expect(findTrigger('note #good morning friend', 25, [])).toEqual({
      sigil: '#',
      start: 5,
      query: 'good morning friend',
    });
  });

  it('both sigils end at a newline', () => {
    expect(findTrigger('#hello\nworld', 12, [])).toBeNull();
    expect(findTrigger('@Marek\nx', 8, [])).toBeNull();
    // caret still on the sigil line keeps the trigger
    expect(findTrigger('#hello there\nx', 12, [])).toEqual({ sigil: '#', start: 0, query: 'hello there' });
  });

  it('no trigger when caret sits inside a finished token', () => {
    const ts: Token[] = [{ start: 0, end: 7, kind: 'person', personId: 'p1' }];
    expect(findTrigger('[marek] x', 9, ts)).toBeNull();
  });

  it('# query stops at an earlier token (no crossing chips)', () => {
    // "«hi» #yo" — the phrase chip occupies 0..4; caret after "yo"
    const ts: Token[] = [{ start: 0, end: 4, kind: 'phrase', phraseId: 'ph1', en: 'hi' }];
    expect(findTrigger('«hi» #yo', 8, ts)).toEqual({ sigil: '#', start: 5, query: 'yo' });
  });
});
