# Notebook — Supabase backend

Everything the cloud side needs for Phase 0. The app is **local-first** and runs fully
offline without any of this; Supabase only adds sync + the two §12 services.

## 1. Database schema + RLS + Storage

Run [`migrations/0001_init.sql`](./migrations/0001_init.sql) once:

- **Dashboard:** SQL Editor → paste the file → Run.
- **CLI:** `supabase db push` (if you use the Supabase CLI with this folder linked).

It creates `people`, `phrases`, `entries`, `drafts` (mirroring the on-device SQLite
schema minus the local-only `synced` column), enables Row Level Security scoped to
`user_id = auth.uid()`, and creates the private `phrase-audio` Storage bucket with a
per-user folder policy.

## 2. Auth

Email + password is used (Dashboard → Authentication → Providers → **Email** enabled).
A `/forgot` password-recovery flow is built in the app (Phase 4 wires the UI; the
mechanism is Supabase `resetPasswordForEmail`).

## 3. Edge Functions

Two functions proxy the paid APIs so **no API key ever ships in the app bundle**:

| Function | Proxies to | Secret it needs |
|---|---|---|
| `translate-phrase` | Anthropic (Claude Haiku 4.5) | `ANTHROPIC_API_KEY` |
| `synthesise-phrase` | Google Cloud TTS (Wavenet) | `GOOGLE_TTS_API_KEY` |

Deploy + set secrets (Supabase CLI):

```bash
# from the repo root, with the CLI linked to your project (supabase link)
supabase functions deploy translate-phrase
supabase functions deploy synthesise-phrase

supabase secrets set ANTHROPIC_API_KEY='sk-ant-...'
supabase secrets set GOOGLE_TTS_API_KEY='AIza...'
```

> **Google TTS auth — API key, not a service account.** Newer Google Cloud orgs enforce
> the "Secure by Default" policy `iam.disableServiceAccountKeyCreation`, which blocks
> service-account *key* downloads. Cloud TTS supports API-key auth on `text:synthesize`,
> so we use a plain API key instead (simpler — no JSON, no JWT). Create it under
> **APIs & Services → Credentials → Create credentials → API key**, then restrict it to
> the **Cloud Text-to-Speech API** (the API must also be **Enabled** on the project).

### Contracts

`POST /translate-phrase`
```jsonc
// request
{ "en": "How was your weekend?", "target_lang": "pl-PL", "for_person_context": "Polish colleague at work, peer" }
// response
{ "tgt": "...", "tgt_romanised": null, "register": "informal", "note": null }
```

`POST /synthesise-phrase`
```jsonc
// request
{ "tgt": "Jak minął weekend?", "lang": "pl-PL", "voice_gender": "female" }
// response
{ "audio_ref": "<uuid>", "mp3_base64": "<base64 mp3>", "voice": "pl-PL-Wavenet-A" }
```

## 4. Smoke test

After deploying + setting secrets, and with `SUPABASE_URL` + `SUPABASE_ANON_KEY` in
`.env`:

```bash
node scripts/test-edge-functions.mjs
```

Expect `✓ translate  ✓ synthesise`.
