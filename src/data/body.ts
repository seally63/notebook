// Body-model helpers (entries.nodes / drafts.nodes = BodyNode[]).
// Phase 1 editing is plain-text (the @/# pickers that create person/phrase nodes
// arrive in Phases 2–3); the READ view already renders every node type.

import type { BodyNode } from '../db/schema';

export const parseNodes = (json: string | null | undefined): BodyNode[] => {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as BodyNode[]) : [];
  } catch {
    return [];
  }
};

export const serializeNodes = (nodes: BodyNode[]): string => JSON.stringify(nodes ?? []);

/** plain text -> nodes (Phase 1 editor commits a single text node) */
export const textToNodes = (text: string): BodyNode[] =>
  text.length ? [{ type: 'text', text }] : [];

/** nodes -> editable plain text (joins text nodes; non-text nodes are ignored in P1) */
export const nodesToText = (nodes: BodyNode[]): string =>
  nodes.filter((n): n is Extract<BodyNode, { type: 'text' }> => n.type === 'text').map((n) => n.text).join('');

export const isEmptyBody = (nodes: BodyNode[]): boolean =>
  nodes.length === 0 || nodes.every((n) => n.type === 'text' && !n.text.trim());

/** true if the body has person/phrase nodes — the Phase 1 plain-text editor can't
 *  represent these yet, so EDIT is gated on text-only entries until the rich editor. */
export const hasRichNodes = (nodes: BodyNode[]): boolean => nodes.some((n) => n.type !== 'text');

export const mentionIds = (nodes: BodyNode[]): string[] =>
  nodes.filter((n): n is Extract<BodyNode, { type: 'person' }> => n.type === 'person').map((n) => n.person_id);

export const phraseIds = (nodes: BodyNode[]): string[] =>
  nodes.filter((n): n is Extract<BodyNode, { type: 'phrase' }> => n.type === 'phrase').map((n) => n.phrase_id);

/** A one-line preview for list rows: text flattened, person nodes as [name] placeholders. */
export const previewText = (nodes: BodyNode[], nameFor: (id: string) => string | undefined): string => {
  const out = nodes
    .map((n) => {
      if (n.type === 'text') return n.text;
      if (n.type === 'person') return `[${(nameFor(n.person_id) ?? '…').toLowerCase()}]`;
      return '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return out;
};
