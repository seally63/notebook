// SQLite migrations. Tracked via PRAGMA user_version; each migration's statements run
// in a transaction, then user_version is bumped. The schema mirrors the Supabase
// Postgres schema (see supabase/migrations/0001_init.sql) minus the local-only `synced`.

export interface Migration {
  version: number;
  statements: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS people (
        id              TEXT PRIMARY KEY NOT NULL,
        user_id         TEXT,
        name            TEXT NOT NULL,
        context         TEXT,
        initial         TEXT,
        lang            TEXT,
        last_mention_at TEXT,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted         INTEGER NOT NULL DEFAULT 0,
        synced          INTEGER NOT NULL DEFAULT 0
      );`,

      `CREATE TABLE IF NOT EXISTS phrases (
        id                  TEXT PRIMARY KEY NOT NULL,
        user_id             TEXT,
        en                  TEXT NOT NULL,
        tgt                 TEXT,
        tgt_romanised       TEXT,
        register            TEXT,
        note                TEXT,
        lang                TEXT,
        for_person          TEXT,
        audio_ref           TEXT,
        tgt_edited          INTEGER NOT NULL DEFAULT 0,
        pending_translation INTEGER NOT NULL DEFAULT 0,
        pending_audio       INTEGER NOT NULL DEFAULT 0,
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL,
        deleted             INTEGER NOT NULL DEFAULT 0,
        synced              INTEGER NOT NULL DEFAULT 0
      );`,

      `CREATE TABLE IF NOT EXISTS entries (
        id          TEXT PRIMARY KEY NOT NULL,
        user_id     TEXT,
        date        TEXT NOT NULL,
        nodes       TEXT NOT NULL DEFAULT '[]',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted     INTEGER NOT NULL DEFAULT 0,
        synced      INTEGER NOT NULL DEFAULT 0
      );`,

      `CREATE TABLE IF NOT EXISTS drafts (
        id          TEXT PRIMARY KEY NOT NULL,
        user_id     TEXT,
        date        TEXT NOT NULL,
        nodes       TEXT NOT NULL DEFAULT '[]',
        saved_at    TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted     INTEGER NOT NULL DEFAULT 0,
        synced      INTEGER NOT NULL DEFAULT 0
      );`,

      // lookup indexes
      `CREATE INDEX IF NOT EXISTS idx_phrases_for_person ON phrases (for_person);`,
      `CREATE INDEX IF NOT EXISTS idx_phrases_lang ON phrases (lang);`,
      `CREATE INDEX IF NOT EXISTS idx_entries_date ON entries (date);`,
      // incremental-sync scan helpers
      `CREATE INDEX IF NOT EXISTS idx_people_unsynced ON people (synced);`,
      `CREATE INDEX IF NOT EXISTS idx_phrases_unsynced ON phrases (synced);`,
      `CREATE INDEX IF NOT EXISTS idx_entries_unsynced ON entries (synced);`,
      `CREATE INDEX IF NOT EXISTS idx_drafts_unsynced ON drafts (synced);`,
      // one open draft per (user_id, date) — §8.1 (COALESCE so local-only/null user works)
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_drafts_user_date
         ON drafts (COALESCE(user_id, ''), date) WHERE deleted = 0;`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
