// Pure tests for the undo/redo stack (src/data/history.ts).

import { initHistory, push, undo, redo, canUndo, canRedo, current } from '../src/data/history';
import type { InputState } from '../src/data/mentions';

const S = (text: string, tokens: InputState['tokens'] = []): InputState => ({ text, tokens });

describe('history stack', () => {
  it('starts with one snapshot, nothing to undo/redo', () => {
    const h = initHistory(S(''));
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
    expect(current(h).text).toBe('');
  });

  it('records every keystroke (letter-by-letter undo)', () => {
    let h = initHistory(S(''));
    h = push(h, S('h'));
    h = push(h, S('he'));
    h = push(h, S('hel'));
    // each letter is its own step
    h = undo(h);
    expect(current(h).text).toBe('he');
    h = undo(h);
    expect(current(h).text).toBe('h');
    h = undo(h);
    expect(current(h).text).toBe('');
    expect(canUndo(h)).toBe(false);
  });

  it('records a paste / big change as one step', () => {
    let h = initHistory(S('hi'));
    h = push(h, S('hi there everyone, big paste'));
    h = undo(h);
    expect(current(h).text).toBe('hi');
  });

  it('a token change is its own step', () => {
    let h = initHistory(S('saw '));
    h = push(h, S('saw [marek] ', [{ start: 4, end: 11, kind: 'person', personId: 'p1' }]));
    expect(canUndo(h)).toBe(true);
    h = undo(h);
    expect(current(h).text).toBe('saw ');
    expect(current(h).tokens).toEqual([]);
  });

  it('redo replays an undone step; new edit drops the redo tail', () => {
    let h = initHistory(S('a'));
    h = push(h, S('a [x] ', [{ start: 2, end: 5, kind: 'person', personId: 'p1' }])); // step 2
    h = undo(h); // back to 'a'
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(current(h).text).toBe('a [x] ');
    // undo then type something new → redo tail gone
    h = undo(h);
    h = push(h, S('a!')); // diverges
    expect(canRedo(h)).toBe(false);
    expect(current(h).text).toBe('a!');
  });

  it('push is a no-op when nothing changed', () => {
    const h0 = initHistory(S('x'));
    const h1 = push(h0, S('x'));
    expect(h1).toBe(h0);
  });

  it('undo/redo are no-ops at the ends', () => {
    const h = initHistory(S('x'));
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
