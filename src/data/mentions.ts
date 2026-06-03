// Inline-token editor model. The compose/edit editor is a single RN TextInput whose
// value is a plain string, with a parallel list of Tokens that pin where inline chips
// live. Two chip kinds, both rendered accent inline (matching the design's [name]):
//   · person      → "[name]"        (tap in read view → person screen)
//   · phrase      → "«english»"     (tap in read view → reveal translation + audio)
//   · phrase_stub → "«english»"     (a phrase being created via the §5 round-trip)
// Saving converts (text, tokens) → BodyNode[]. These helpers are PURE (no RN / DB) so
// they're unit-testable.
//
// Tokens are ATOMIC: an edit that touches any character of a token destroys the whole
// token (matches the mock's backspace-pops-the-node behaviour, and prevents a
// half-edited chip from masquerading as a live ref).

import type { BodyNode } from '../db/schema';

export type Token =
  | { start: number; end: number; kind: 'person'; personId: string }
  | { start: number; end: number; kind: 'phrase'; phraseId: string; en: string }
  | { start: number; end: number; kind: 'phrase_stub'; localId: string; en: string };

export interface InputState {
  text: string;
  tokens: Token[];
}

/** the visible chip text for a person, e.g. "[marek]" (lowercased, matches PersonRef). */
export const personToken = (name: string): string => `[${(name || '…').toLowerCase()}]`;
/** the visible chip text for a phrase — the English in guillemets, e.g. «how are you?». */
export const phraseToken = (en: string): string => `«${(en || 'new phrase').trim()}»`;

/** BodyNode[] → editor (text, tokens). text + person + phrase + stub all become inline
 *  tokens in document order. Needs name/English lookups to render the chip text. */
export function nodesToInput(
  nodes: BodyNode[],
  nameFor: (id: string) => string | undefined,
  enFor: (id: string) => string | undefined = () => undefined,
): InputState {
  let text = '';
  const tokens: Token[] = [];
  for (const n of nodes) {
    if (n.type === 'text') {
      text += n.text;
    } else if (n.type === 'person') {
      const t = personToken(nameFor(n.person_id) ?? '…');
      tokens.push({ start: text.length, end: text.length + t.length, kind: 'person', personId: n.person_id });
      text += t;
    } else if (n.type === 'phrase') {
      const en = enFor(n.phrase_id) ?? '…';
      const t = phraseToken(en);
      tokens.push({ start: text.length, end: text.length + t.length, kind: 'phrase', phraseId: n.phrase_id, en });
      text += t;
    } else if (n.type === 'phrase_stub') {
      const t = phraseToken(n.en);
      tokens.push({ start: text.length, end: text.length + t.length, kind: 'phrase_stub', localId: n.local_id, en: n.en });
      text += t;
    }
  }
  return { text, tokens };
}

/** editor (text, tokens) → BodyNode[]. Text runs between tokens become text nodes (empty
 *  runs dropped); tokens become their node form, in document order. */
export function inputToNodes(state: InputState): BodyNode[] {
  const { text } = state;
  const tokens = [...state.tokens].sort((a, b) => a.start - b.start);
  const nodes: BodyNode[] = [];
  let cur = 0;
  const pushText = (s: string) => {
    if (s.length) nodes.push({ type: 'text', text: s });
  };
  for (const t of tokens) {
    if (t.start > cur) pushText(text.slice(cur, t.start));
    if (t.kind === 'person') nodes.push({ type: 'person', person_id: t.personId });
    else if (t.kind === 'phrase') nodes.push({ type: 'phrase', phrase_id: t.phraseId });
    else nodes.push({ type: 'phrase_stub', local_id: t.localId, en: t.en });
    cur = t.end;
  }
  if (cur < text.length) pushText(text.slice(cur));
  return nodes;
}

/** length of the longest common prefix of a and b. */
function commonPrefix(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

/** length of the longest common suffix of a and b that doesn't overlap the given prefix. */
function commonSuffix(a: string, b: string, prefix: number): number {
  const max = Math.min(a.length, b.length) - prefix;
  let i = 0;
  while (i < max && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

/**
 * Reconcile a raw text change (from TextInput.onChangeText) against the current tokens.
 * Tokens wholly before the edit survive; tokens wholly after shift by the length delta;
 * any token the edit touched is removed (atomic — the edit region snaps to token bounds).
 */
export function reconcile(oldText: string, tokens: Token[], newText: string): InputState {
  if (oldText === newText) return { text: newText, tokens };

  let p = commonPrefix(oldText, newText);
  const s0 = commonSuffix(oldText, newText, p);

  // snap the edit region out of any token interior so tokens are never split
  let editStart = p;
  let editEnd = oldText.length - s0;
  for (const t of tokens) {
    if (editStart > t.start && editStart < t.end) editStart = t.start;
    if (editEnd > t.start && editEnd < t.end) editEnd = t.end;
  }

  const shift = newText.length - oldText.length;
  const next: Token[] = [];
  for (const t of tokens) {
    if (t.end <= editStart) {
      next.push(t); // before the edit — unchanged
    } else if (t.start >= editEnd) {
      next.push({ ...t, start: t.start + shift, end: t.end + shift }); // after — shifted
    }
    // overlapping the edit region → dropped
  }
  return { text: newText, tokens: next };
}

/** Shared insert: replace [from, to) with `chip` + trailing space, shift tokens, add the
 *  new token, return the post-insert caret. */
function insertToken(
  state: InputState,
  from: number,
  to: number,
  chip: string,
  make: (start: number) => Token,
): InputState & { caret: number } {
  const insert = chip + ' ';
  const text = state.text.slice(0, from) + insert + state.text.slice(to);
  const delta = insert.length - (to - from);

  const tokens: Token[] = [];
  for (const t of state.tokens) {
    if (t.end <= from) tokens.push(t);
    else if (t.start >= to) tokens.push({ ...t, start: t.start + delta, end: t.end + delta });
    // any token overlapping the replaced range is dropped
  }
  tokens.push(make(from));
  tokens.sort((a, b) => a.start - b.start);
  return { text, tokens, caret: from + insert.length };
}

/** Insert a person chip, replacing [from, to) (the `@query`). */
export function insertPerson(
  state: InputState,
  from: number,
  to: number,
  personId: string,
  name: string,
): InputState & { caret: number } {
  const chip = personToken(name);
  return insertToken(state, from, to, chip, (start) => ({ start, end: start + chip.length, kind: 'person', personId }));
}

/** Insert a phrase chip, replacing [from, to) (the `#query`). */
export function insertPhrase(
  state: InputState,
  from: number,
  to: number,
  phraseId: string,
  en: string,
): InputState & { caret: number } {
  const chip = phraseToken(en);
  return insertToken(state, from, to, chip, (start) => ({ start, end: start + chip.length, kind: 'phrase', phraseId, en }));
}

/** Insert a phrase STUB chip (the §5 round-trip placeholder before the phrase exists). */
export function insertPhraseStub(
  state: InputState,
  from: number,
  to: number,
  localId: string,
  en: string,
): InputState & { caret: number } {
  const chip = phraseToken(en);
  return insertToken(state, from, to, chip, (start) => ({ start, end: start + chip.length, kind: 'phrase_stub', localId, en }));
}

/**
 * Upgrade any phrase_stub token whose local_id now exists as a real phrase (per `enFor`,
 * which returns the phrase's English or undefined if it doesn't exist yet). Re-renders the
 * chip text from the real English and re-positions following tokens. Pure; idempotent.
 *
 * Stubs use the future phrase's id as their local_id (createPhrase reuses it), so this is
 * a robust DB-lookup resolve that doesn't depend on navigation params surviving a modal.
 */
export function resolvePhraseStubs(state: InputState, enFor: (phraseId: string) => string | undefined): InputState {
  const stubs = state.tokens.filter((t) => t.kind === 'phrase_stub' && enFor(t.localId) !== undefined);
  if (stubs.length === 0) return state;
  // rebuild left→right so shifting indices stay correct
  let text = '';
  const tokens: Token[] = [];
  const sorted = [...state.tokens].sort((a, b) => a.start - b.start);
  let cur = 0;
  for (const t of sorted) {
    text += state.text.slice(cur, t.start); // plain text before this token
    if (t.kind === 'phrase_stub' && enFor(t.localId) !== undefined) {
      const en = enFor(t.localId) as string;
      const chip = phraseToken(en);
      tokens.push({ start: text.length, end: text.length + chip.length, kind: 'phrase', phraseId: t.localId, en });
      text += chip;
    } else {
      const chip = state.text.slice(t.start, t.end);
      tokens.push({ ...t, start: text.length, end: text.length + chip.length });
      text += chip;
    }
    cur = t.end;
  }
  text += state.text.slice(cur);
  return { text, tokens };
}

/**
 * Detect an active `@`/`#` trigger ending at the caret. Scans back from the caret to the
 * sigil; the sigil must start the text or follow whitespace, and the run must not cross a
 * newline or an existing token. BOTH sigils allow spaces in the query (names like "Pani
 * Krystyna" and multi-word phrases), so a space no longer drops you out — the picker ends
 * only on a newline, an existing token, deleting the sigil, or making a selection.
 */
export function findTrigger(
  text: string,
  caret: number,
  tokens: Token[],
): { sigil: '@' | '#'; start: number; query: string } | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '\n') return null; // a trigger never spans lines
    if (tokens.some((t) => i >= t.start && i < t.end)) return null; // hit / inside a token
    if (ch === '@' || ch === '#') {
      const before = i === 0 ? ' ' : text[i - 1];
      if (i !== 0 && !/\s/.test(before)) return null; // sigil must start a word
      return { sigil: ch, start: i, query: text.slice(i + 1, caret) };
    }
    i--;
  }
  return null;
}
