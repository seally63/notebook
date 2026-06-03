-- ============================================================================
-- Notebook · Phase 3 follow-up — gendered translation variants (§12)
-- ----------------------------------------------------------------------------
-- Some languages (Polish, Ukrainian, Russian past tense / adjectives) change form
-- with the SPEAKER's gender. We store the male/female forms (+ romanisation) as a
-- jsonb array so the phrase reveal can show both. Default '[]' = no gendered forms.
--
-- Run in the Supabase dashboard → SQL Editor (or `supabase db push`).
-- Mirrors the on-device SQLite migration v2 (phrases.variants TEXT).
-- ============================================================================

alter table public.phrases
  add column if not exists variants jsonb not null default '[]'::jsonb;

-- Shape of each element (not enforced, documented):
--   { "gender": "male" | "female", "tgt": text, "romanised": text | null }
