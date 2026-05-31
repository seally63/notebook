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

Search / Lately / People / Phrases remain placeholders (Phases 2–4).

Project conventions, per-phase plan, and the full design contract live in the
design-handoff bundle's `ROUTING.md` (not committed to this repo).
