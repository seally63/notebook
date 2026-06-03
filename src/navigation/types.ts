// Navigation param lists. The 3 home routes live in a bottom-tab navigator (the Dock);
// everything else is a push or modal on the root native-stack (§1).

import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeTabParamList = {
  Search: undefined;
  Write: undefined; // JournalList — the WRITE home (dock highlights WRITE here)
  Lately: undefined;
};

export type RootStackParamList = {
  // onboarding (auth) — skippable
  Welcome: undefined;
  SignIn: undefined;
  Register: undefined;
  // app
  Home: NavigatorScreenParams<HomeTabParamList>;
  // compose: a NEW entry / resume today's draft. Named 'Compose' (not 'Write') to avoid
  // colliding with the 'Write' home TAB. Editing an existing entry is edit-on-tap on the
  // Entry screen, not a separate compose launch. (§5 stubs resolve by DB lookup on focus.)
  Compose: undefined;
  Entry: { id: string };
  // people library (no dock — reached via Search, Settings·LIBRARY, inline [name])
  People: undefined;
  PersonDetail: { id: string };
  PersonNew: { id?: string } | undefined; // modal (close-X); id present = edit mode
  // phrases library (no dock — reached via Search, Settings·LIBRARY, entry/#)
  Phrases: { personId?: string } | undefined; // optional filter to one person
  PhraseNew:
    | {
        // prefill from compose/person; stubLocalId becomes the new phrase's id so the
        // opener resolves its in-text stub by DB lookup on focus (§5).
        en?: string;
        personId?: string;
        stubLocalId?: string;
      }
    | undefined;
  PhrasePractice: { personId?: string } | undefined;
  // settings — modal (close-X), reached from Lately's ☰
  Settings: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
