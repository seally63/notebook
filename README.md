# Notebook

A journal-first relationship & language companion. **Local-first** — on-device SQLite
is the source of truth; the app works fully offline except for translation + TTS.
Supabase is a sync layer. Bare React Native (TypeScript), iOS + Android.

The design + behaviour contract lives in the separate design-handoff bundle
(`ROUTING.md` is authoritative) — kept outside version control. The visual system is "Carbon".

---

## Stack

- **Bare React Native 0.85** (TypeScript), New Architecture
- **@react-navigation** native-stack (push/modal) + bottom-tabs (the 3 home routes)
- **react-native-svg** — the hand-drawn Icon set (ported verbatim, `currentColor`-driven)
- **@op-engineering/op-sqlite** — on-device DB (source of truth) · *see Phase 0 notes*
- **react-native-mmkv** — sync timestamps + Supabase session
- **@react-native-community/netinfo** — connectivity awareness
- **@supabase/supabase-js** — auth + Postgres + Storage + Edge Functions
- **Geist / Geist Mono** — bundled (not network-loaded) via `react-native-asset`

## Setup

```bash
npm install
# iOS pods (use brew CocoaPods; see Phase 0 notes on Ruby):
LANG=en_US.UTF-8 pod install --project-directory=ios
cp .env.example .env          # fill in Supabase URL + anon key (optional; app runs without)
```

Backend: see [`supabase/README.md`](./supabase/README.md) for the SQL, RLS, Storage,
and the two Edge Functions.

## Run

```bash
npm start                     # Metro
# iOS  (simulator):  build the workspace in Xcode, or:
xcodebuild -workspace ios/Notebook.xcworkspace -scheme Notebook -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath ios/build build
# Android:           npm run android   (needs Android SDK — Phase 0 notes)
```

## Test

```bash
npm test                      # jest — includes the sync engine unit tests
npx tsc --noEmit              # typecheck
node scripts/test-edge-functions.mjs   # smoke-test deployed Edge Functions
```

---

## Build status — Phase 0 (Foundation)

What's now buildable:

- ✅ Bare RN TS app boots to the 3 home routes (**SEARCH · WRITE · LATELY**) via the
  floating **Dock**; the back(`‹`)/close(`✕`) navigation contract works (incl. Android).
- ✅ **Carbon theme** (`src/theme`) — typed port of the design tokens.
- ✅ **Icon** set (`src/components/Icon.tsx`) — SVG paths copied verbatim, `currentColor`.
- ✅ Shared chrome: `Dock` (§9), `ScreenHeader` (§10.1), `Screen` — real safe-area math.
- ✅ **Geist + Geist Mono** bundled (static weights) and rendering.
- ✅ **SQLite** initialised on start with migrations (`src/db`).
- ✅ **Sync engine** (`src/sync`) — push/pull/last-write-wins/soft-delete/idempotent,
  unit-tested with in-memory mocks (`__tests__/sync.test.ts`).
- ✅ **NetInfo** wired; connectivity state global; sync triggers on "online".
- ✅ **Supabase** schema + RLS + Storage SQL and both **Edge Functions** authored
  (`supabase/`), ready to deploy.

## Build status — Phase 1 (Core journal loop)

- ✅ Auth screens **Welcome / SignIn / Register** (email + password, **skippable** — "use
  without an account" enters local-first; sign-in back-fills local rows + activates sync).
- ✅ **JournalList** (`/`) — NOTEBOOK header, TODAY block (resume draft / open today's
  entry / start new — §8.4), recent entries with inline `[name]` refs + phrase line.
- ✅ **/write** (one screen, two states) with full §8 autosave: 800ms debounce +
  force-save on blur/background/nav-away; `SAVING… → DRAFT · SAVED hh:mm` heartbeat;
  CANCEL → KEEP/DISCARD sheet; SAVE commits → `/entry/:id`. Android hardware back routes
  through KEEP/DISCARD.
- ✅ **JournalEntry** (`/entry/:id`) — read view with inline `[name]` refs + phrase
  cards; EDIT → `/write` (edit mode, gated to text-only entries in P1).
- ✅ Local-first data layer (`src/data/`): entries + drafts repositories, ref resolver,
  current-user tracking; @/# pickers stubbed to a "next phase" sheet.

## Build status — Phase 2 (People)

- ✅ **Mention-aware compose editor** — the `@` button / typing `@` opens a live people
  picker; selecting inserts an inline **accent `[name]` chip** bound to a real
  `person_id`. Single `TextInput` driven by styled `<Text>` children (no extra dep);
  tokens are atomic (editing one removes it). Reconciler is pure + unit-tested
  (`__tests__/mentions.test.ts`, 21 cases). `#` still opens the Phase-3 stub.
- ✅ **Inline create** (§5): typing an unknown name → "＋ New person · [name]" creates
  them inline and tags the entry, no navigation.
- ✅ **Same-name disambiguation**: picker + People rows show context; when names collide
  and context is blank, fall back to a distinguishing line (`last seen 27 May` /
  `added 31 May`) so two "Chloe"s are never identical (`src/lib/personHint.ts`).
- ✅ **People library** — `PeopleList` (`/people`, search + A–Z sections + lang/phrase
  count + last-mention), `PersonDetail` (`/people/:id` — identity, PHRASES, IN THE
  JOURNAL → `/entry/:id`), `PersonQuickAdd` (`/people/new`, modal; also edit mode).
- ✅ **Inline `[name]` taps → `/people/:id`** from the journal list + entry read view.
- ✅ **`last_mention_at`** recomputed from the journal on every entry create/commit/edit.
- ✅ **Edit-on-tap with a tappable read view**: a committed entry opens read-only (no EDIT
  button). Tapping an inline `[name]` opens that person's screen (so you know *which*
  Chloe); tapping the body text starts editing — cursor + keyboard up, header swaps to
  CANCEL / SAVE; CANCEL while dirty offers KEEP / DISCARD CHANGES (§8.5). The compose +
  edit editor is shared as `<ComposerBody>`. (Phrase entries stay read-only until Phase 3.)
- ⏳ Interim **LIBRARY → All people** lives on Lately until Settings/Search land (Phase 4).
- ℹ️ No schema change — `people` already carried `context` / `lang` / `last_mention_at`.

## Build status — Phase 3 (Phrases + services)

- ✅ **Phrase creation (§12)** — `/phrases/new`: type **English only**; language auto-infers
  from the tagged person (overridable); SAVE is non-blocking (writes the row with pending
  flags, then the background pipeline auto-translates + auto-synthesises). Manual target
  override marks `tgt_edited` so re-translation won't clobber it.
- ✅ **Services** (`src/services`): `translate.ts` (→ `translate-phrase`, Anthropic Haiku),
  `tts.ts` (→ `synthesise-phrase`, Google TTS) + `audioCache.ts` (mp3 → device cache,
  best-effort Storage upload) + `player.ts` (shared `react-native-nitro-sound` player).
- ✅ **Audio playback** — the ▶ on phrase cards / lists / People-detail / TODAY plays the
  cached mp3 (restoring from Storage if missing); spinner while `pending_audio`.
- ✅ **`/phrases`** grouped by person (FOR [name] · LANG) + GENERAL; **`/phrases/practise`**
  flip-card session (REVEAL plays audio, NEXT / SHUFFLE).
- ✅ **Inline phrase chips (unified with @)** — typing `#` (or the toolbar button) opens
  the phrase picker; picking/creating inserts an inline accent **`«english»` chip** right
  at the caret, exactly like `[name]`. Person + phrase are one inline-token model
  (`src/data/mentions.ts`, 20 unit tests). "＋ NEW PHRASE" inserts a stub chip + the
  `/phrases/new` round-trip; the stub resolves in place on return (`resolveStubToken`).
- ✅ **Tap-to-reveal translation** — in a read view, tapping a `«phrase»` chip reveals a
  panel right there: target translation + **romanisation** (for Cyrillic — RU/UK) + ▶
  audio. No more card dumped at the bottom of the entry.
- ✅ **Live refresh** — a phrase pub/sub (`subscribePhrases`) updates the inline reveal in
  place as translation/audio resolve in the background — no need to leave + re-open.
- ✅ **Romanisation shown** everywhere a phrase is revealed (was generated + stored all
  along; the old card just never rendered it).
- ✅ **Phrase entries fully editable** — committed entries with phrases open read-only;
  tap text → edit (toolbar, @/# pickers, atomic chips). No read-only gate.
- ✅ **"+ ADD" phrase for a person** on PersonDetail; **All phrases** entry on Lately.
- ✅ Offline-safe: pending phrases resolve on startup + on reconnect (`resolvePendingPhrases`).
- 🔌 Needs the two Edge Functions **deployed** with secrets — see `supabase/README.md`.
  No SQL/schema change (the `phrases` table already had every column).
- ➕ Deps: `react-native-nitro-sound` (Nitro player) + `@dr.pogodin/react-native-fs` (mp3 cache).

## Build status — Phase 4 (Lately · Search · Settings)

- ✅ **Lately** (`/lately`) — built from the local DB (`src/data/lately.ts`): a Mon-first
  **4-week calendar** (days with a committed entry marked, dot scaled by length, today
  filled, tap → that entry); **CARRY OVER** — forward-looking notes-to-self pulled from
  recent entries by a tested heuristic (`src/data/carryover.ts`), attributed to the
  mentioned person, tap → source entry; **QUIET FOR A WHILE** — people not mentioned in
  14+ days → `/people/:id`. The ☰ opens Settings.
- ✅ **Search** (`/search`) — one live-filter query across **people / entries / phrases**
  (`src/data/search.ts`) with match highlighting + routing to each detail; **OR BROWSE**
  chips (ENTRIES / PEOPLE / PHRASES) are the durable doors into the libraries.
- ✅ **Settings** (`/settings`, modal via Lately ☰) — real actions only: **ACCOUNT**
  (email + sign out / sign in), **LIBRARY** (All people / All phrases), **LANGUAGES**
  (derived from people + phrase counts), **DATA** (Export all entries → Markdown via the
  share sheet; Delete this notebook → local wipe, cloud copy kept if signed in), **ABOUT**.
- ✅ Interim LIBRARY/ACCOUNT blocks removed from Lately (now in Settings).
- ℹ️ No schema change, no new dependencies (export uses RN `Share` + existing
  `react-native-fs`).

Project conventions, per-phase plan, and the full design contract live in the
design-handoff bundle's `ROUTING.md` (not committed to this repo).
