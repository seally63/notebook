// Mention-aware editor model (Phase 2). The compose editor is a single RN TextInput
// whose value is a plain string, with a parallel list of Mention spans that pin where
// person tokens (`[name]`) live. Rendering styles those spans accent (the inline chip);
// saving converts (text, mentions) → BodyNode[]. These helpers are PURE (no RN / DB)
// so they're unit-testable.
//
// Person tokens are ATOMIC: an edit that touches any character of a token destroys the
// whole token (matches the mock's backspace-pops-the-node behaviour and prevents a
// half-edited `[mar]` from masquerading as a live mention).

import type { BodyNode } from '../db/schema';

export interface Mention {
  start: number; // index of '[' in the text
  end: number; // index just past ']' (exclusive)
  personId: string;
}

export interface InputState {
  text: string;
  mentions: Mention[];
}

/** the visible token for a person, e.g. "[marek]" (lowercased, matches PersonRef). */
export const mentionToken = (name: string): string => `[${(name || '…').toLowerCase()}]`;

/** BodyNode[] → editor (text, mentions). Phrase nodes are ignored (not editable in P2). */
export function nodesToInput(nodes: BodyNode[], nameFor: (id: string) => string | undefined): InputState {
  let text = '';
  const mentions: Mention[] = [];
  for (const n of nodes) {
    if (n.type === 'text') {
      text += n.text;
    } else if (n.type === 'person') {
      const token = mentionToken(nameFor(n.person_id) ?? '…');
      mentions.push({ start: text.length, end: text.length + token.length, personId: n.person_id });
      text += token;
    }
    // phrase / phrase_stub: not represented in the P2 text editor
  }
  return { text, mentions };
}

/** editor (text, mentions) → BodyNode[]. Empty text runs are dropped; order preserved. */
export function inputToNodes(state: InputState): BodyNode[] {
  const { text } = state;
  const mentions = [...state.mentions].sort((a, b) => a.start - b.start);
  const nodes: BodyNode[] = [];
  let cur = 0;
  const pushText = (s: string) => {
    if (s.length) nodes.push({ type: 'text', text: s });
  };
  for (const m of mentions) {
    if (m.start > cur) pushText(text.slice(cur, m.start));
    nodes.push({ type: 'person', person_id: m.personId });
    cur = m.end;
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
 * Reconcile a raw text change (from TextInput.onChangeText) against the current
 * mentions. Returns the new (text, mentions): mentions wholly before the edit survive
 * unchanged, mentions wholly after shift by the length delta, and any mention the edit
 * touched is removed (tokens are atomic — the edit region is snapped to token bounds).
 */
export function reconcile(oldText: string, mentions: Mention[], newText: string): InputState {
  if (oldText === newText) return { text: newText, mentions };

  let p = commonPrefix(oldText, newText);
  let s = commonSuffix(oldText, newText, p);

  // snap the edit region out of any token interior so tokens are never split
  let editStart = p;
  let editEnd = oldText.length - s;
  for (const m of mentions) {
    if (editStart > m.start && editStart < m.end) editStart = m.start;
    if (editEnd > m.start && editEnd < m.end) editEnd = m.end;
  }
  p = editStart;
  s = oldText.length - editEnd;

  const shift = newText.length - oldText.length;
  const next: Mention[] = [];
  for (const m of mentions) {
    if (m.end <= editStart) {
      next.push(m); // before the edit — unchanged
    } else if (m.start >= editEnd) {
      next.push({ ...m, start: m.start + shift, end: m.end + shift }); // after — shifted
    }
    // overlapping the edit region → dropped
  }
  return { text: newText, mentions: next };
}

/**
 * Insert a person token, replacing the text in [from, to) (the `@query` the user typed,
 * or just the caret when from === to). Adds a trailing space. Returns the new state plus
 * the caret position to place after the insert.
 */
export function insertMention(
  state: InputState,
  from: number,
  to: number,
  personId: string,
  name: string,
): InputState & { caret: number } {
  const token = mentionToken(name);
  const insert = token + ' ';
  const text = state.text.slice(0, from) + insert + state.text.slice(to);
  const removed = to - from;
  const added = insert.length;
  const delta = added - removed;

  const mentions: Mention[] = [];
  for (const m of state.mentions) {
    if (m.end <= from) mentions.push(m);
    else if (m.start >= to) mentions.push({ ...m, start: m.start + delta, end: m.end + delta });
    // any mention overlapping the replaced range is dropped
  }
  mentions.push({ start: from, end: from + token.length, personId });
  mentions.sort((a, b) => a.start - b.start);

  return { text, mentions, caret: from + insert.length };
}

/**
 * Detect an active `@` mention trigger ending at the caret: an '@' that is at the start
 * of the text or preceded by whitespace, with only non-whitespace, non-token characters
 * between it and the caret. Returns the query (text after '@') and the '@' index.
 */
export function findTrigger(
  text: string,
  caret: number,
  mentions: Mention[],
): { start: number; query: string } | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === '@') {
      const before = i === 0 ? ' ' : text[i - 1];
      if (!/\s/.test(before) && i !== 0) return null; // '@' must start a word
      // the trigger must not start inside an existing token
      if (mentions.some((m) => i >= m.start && i < m.end)) return null;
      return { start: i, query: text.slice(i + 1, caret) };
    }
    if (/\s/.test(ch)) return null; // whitespace before reaching '@' → no trigger
    // caret sitting inside a finished token is not a trigger
    if (mentions.some((m) => i >= m.start && i < m.end)) return null;
    i--;
  }
  return null;
}
