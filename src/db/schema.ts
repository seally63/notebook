// TypeScript row types — identical shape on SQLite (source of truth) and Supabase.
// SQLite has no boolean type, so flag columns are 0/1 integers. JSONB columns
// (entries.nodes / drafts.nodes) are stored as TEXT (serialized BodyNode[]) on-device
// and as jsonb on Postgres.

export type Bool = 0 | 1;

// Columns every syncable row carries.
export interface SyncMeta {
  created_at: string; // ISO-8601 UTC
  updated_at: string; // ISO-8601 UTC — drives last-write-wins
  deleted: Bool; // soft delete; never hard-DELETE
  synced: Bool; // LOCAL-ONLY: 0 = needs push. Stripped before upload.
}

export interface PersonRow extends SyncMeta {
  id: string; // client-generated uuid
  user_id: string | null;
  name: string;
  context: string | null; // e.g. "Tesco warehouse"
  initial: string | null; // derived
  lang: string | null; // BCP-47 (pl-PL / uk-UA / ru-RU) — drives §12 inference
  last_mention_at: string | null;
}

export type Register = 'informal' | 'neutral' | 'formal';

export interface PhraseRow extends SyncMeta {
  id: string;
  user_id: string | null;
  en: string; // the only required user input (§12)
  tgt: string | null; // auto-translated; null while pending
  tgt_romanised: string | null; // transliteration; null for Polish
  register: Register | null;
  note: string | null; // optional usage note from translation
  lang: string | null; // BCP-47, inferred from for_person.lang
  for_person: string | null; // FK -> people.id
  audio_ref: string | null; // uuid → local cache + Storage key
  tgt_edited: Bool; // §12.2 manual override flag
  pending_translation: Bool; // offline-create flag
  pending_audio: Bool; // offline-create flag
}

// The rich body of an entry/draft — an array of these nodes (serialized to JSON).
export type BodyNode =
  | { type: 'text'; text: string }
  | { type: 'person'; person_id: string } // renders as [name]
  | { type: 'phrase'; phrase_id: string } // renders as a phrase card
  | { type: 'phrase_stub'; local_id: string; en: string }; // §5 round-trip stub

export interface EntryRow extends SyncMeta {
  id: string;
  user_id: string | null;
  date: string; // YYYY-MM-DD
  nodes: string; // JSON.stringify(BodyNode[])
}

export interface DraftRow extends SyncMeta {
  id: string;
  user_id: string | null;
  date: string; // YYYY-MM-DD — at most one open draft per (user_id, date) (§8.1)
  nodes: string; // JSON.stringify(BodyNode[])
  saved_at: string | null; // last autosave time (header heartbeat §8.3)
}

// The set of syncable tables. Order matters for FK-friendly upserts (people before
// phrases before entries/drafts).
export const SYNC_TABLES = ['people', 'phrases', 'entries', 'drafts'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

// Columns that exist ONLY locally and must be stripped before pushing to Supabase.
export const LOCAL_ONLY_COLUMNS = ['synced'] as const;
