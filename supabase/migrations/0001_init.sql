-- ============================================================================
-- Notebook · Phase 0 schema — Supabase (Postgres + RLS + Storage)
-- ----------------------------------------------------------------------------
-- Run this in the Supabase dashboard → SQL Editor (or `supabase db push`).
-- Mirrors the on-device SQLite schema, MINUS the local-only `synced` column.
--
-- Conventions:
--   * id is the CLIENT-generated uuid (offline creates keep a stable id through sync).
--   * updated_at is CLIENT-controlled (drives last-write-wins). We deliberately do NOT
--     add a trigger to overwrite it on the server — that would break LWW.
--   * deleted is a soft-delete flag; rows are never hard-DELETEd.
--   * RLS: every row is scoped to its owner (user_id = auth.uid()).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------------------

-- people --------------------------------------------------------------------
create table if not exists public.people (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  context         text,
  initial         text,
  lang            text,                 -- BCP-47 (pl-PL / uk-UA / ru-RU)
  last_mention_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted         boolean    not null default false
);

-- phrases -------------------------------------------------------------------
create table if not exists public.phrases (
  id                  uuid primary key,
  user_id             uuid not null references auth.users (id) on delete cascade,
  en                  text not null,                       -- the only required input (§12)
  tgt                 text,                                -- auto-translated; null while pending
  tgt_romanised       text,                                -- transliteration; null for Polish
  register            text check (register in ('informal','neutral','formal')),
  note                text,
  lang                text,                                -- BCP-47
  for_person          uuid references public.people (id) on delete set null,
  audio_ref           text,                                -- uuid → Storage key / local cache
  tgt_edited          boolean not null default false,      -- §12.2 manual override
  pending_translation boolean not null default false,
  pending_audio       boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted             boolean    not null default false
);

-- entries -------------------------------------------------------------------
create table if not exists public.entries (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  nodes       jsonb not null default '[]'::jsonb,          -- BodyNode[]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean    not null default false
);

-- drafts --------------------------------------------------------------------
-- Drafts DO sync (survive device loss) but never show as journal rows (§8.1).
create table if not exists public.drafts (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  date        date not null,
  nodes       jsonb not null default '[]'::jsonb,
  saved_at    timestamptz,                                 -- last autosave (§8.3)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean    not null default false
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES (incremental-pull scans + lookups)
-- ----------------------------------------------------------------------------
create index if not exists idx_people_user_updated  on public.people  (user_id, updated_at);
create index if not exists idx_phrases_user_updated on public.phrases (user_id, updated_at);
create index if not exists idx_entries_user_updated on public.entries (user_id, updated_at);
create index if not exists idx_drafts_user_updated  on public.drafts  (user_id, updated_at);
create index if not exists idx_phrases_for_person   on public.phrases (for_person);

-- At most one OPEN draft per (user, date) — §8.1.
create unique index if not exists uq_drafts_user_date
  on public.drafts (user_id, date) where (deleted = false);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY — every table scoped to its owner
-- ----------------------------------------------------------------------------
alter table public.people  enable row level security;
alter table public.phrases enable row level security;
alter table public.entries enable row level security;
alter table public.drafts  enable row level security;

-- One FOR ALL policy per table (covers select/insert/update/delete).
do $$
declare t text;
begin
  foreach t in array array['people','phrases','entries','drafts']
  loop
    execute format('drop policy if exists "own_rows" on public.%I;', t);
    execute format($f$
      create policy "own_rows" on public.%I
        for all
        using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. STORAGE — phrase audio (mp3), private bucket scoped by user folder
-- ----------------------------------------------------------------------------
-- Upload convention: object path = "{user_id}/{audio_ref}.mp3" so the first path
-- segment carries ownership. Playback always reads from the on-device cache; this
-- bucket is backup + cross-device restore (§12).
insert into storage.buckets (id, name, public)
values ('phrase-audio', 'phrase-audio', false)
on conflict (id) do nothing;

drop policy if exists "phrase_audio_rw" on storage.objects;
create policy "phrase_audio_rw" on storage.objects
  for all
  using (
    bucket_id = 'phrase-audio'
    and (storage.foldername(name))[1] = (auth.uid())::text
  )
  with check (
    bucket_id = 'phrase-audio'
    and (storage.foldername(name))[1] = (auth.uid())::text
  );

-- ============================================================================
-- End of 0001_init.sql
-- ============================================================================
