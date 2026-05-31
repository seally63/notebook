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
  // compose: new/resume draft, or edit an entry. Named 'Compose' (not 'Write') to
  // avoid colliding with the 'Write' home TAB (the dock leg).
  Compose: { entryId?: string } | undefined;
  Entry: { id: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
