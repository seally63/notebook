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
  // Entry screen, not a separate compose launch.
  Compose: undefined;
  Entry: { id: string };
  // people library (no dock — reached via Search, Settings·LIBRARY, inline [name])
  People: undefined;
  PersonDetail: { id: string };
  PersonNew: { id?: string } | undefined; // modal (close-X); id present = edit mode
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
