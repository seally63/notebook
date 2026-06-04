// A small undo/redo stack over editor InputState (text + tokens). Pure (no RN), so it's
// unit-testable. Used by ComposerBody for in-session edit history — it does NOT touch
// navigation or saved versions; it resets each time the editor mounts with a fresh entry.
//
// Granularity: LETTER-BY-LETTER. Every distinct change records its own snapshot, so undo
// steps back one keystroke / chip at a time (no word/run coalescing). push() drops any
// redo tail and ignores no-op repeats.

import type { InputState } from './mentions';

export interface HistoryState {
  stack: InputState[];
  index: number; // points at the current snapshot
}

export const initHistory = (initial: InputState): HistoryState => ({ stack: [initial], index: 0 });

export const canUndo = (h: HistoryState): boolean => h.index > 0;
export const canRedo = (h: HistoryState): boolean => h.index < h.stack.length - 1;
export const current = (h: HistoryState): InputState => h.stack[h.index];

/** Record a new snapshot for every change (letter-by-letter). Drops any redo tail; a
 *  no-op (identical text + tokens) is ignored so undo never stalls on a dead step. */
export function push(h: HistoryState, next: InputState): HistoryState {
  const cur = h.stack[h.index];
  if (cur.text === next.text && sameTokens(cur, next)) return h; // no-op
  const stack = h.stack.slice(0, h.index + 1);
  stack.push(next);
  return { stack, index: stack.length - 1 };
}

export function undo(h: HistoryState): HistoryState {
  return canUndo(h) ? { stack: h.stack, index: h.index - 1 } : h;
}

export function redo(h: HistoryState): HistoryState {
  return canRedo(h) ? { stack: h.stack, index: h.index + 1 } : h;
}

function sameTokens(a: InputState, b: InputState): boolean {
  if (a.tokens.length !== b.tokens.length) return false;
  for (let i = 0; i < a.tokens.length; i++) {
    const x = a.tokens[i];
    const y = b.tokens[i];
    if (x.start !== y.start || x.end !== y.end || x.kind !== y.kind) return false;
  }
  return true;
}
