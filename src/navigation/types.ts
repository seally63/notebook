// Navigation param lists. The 3 home routes live in a bottom-tab navigator (the Dock);
// everything else is a push or modal on the root native-stack (§1).
// Phase 0 includes two demo destinations to exercise the back(‹)/close(✕) contract;
// later phases replace them with /entry/:id, /people/:id, /phrases, etc.

import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeTabParamList = {
  Search: undefined;
  Write: undefined; // JournalList — the WRITE home (dock highlights WRITE here)
  Lately: undefined;
};

export type RootStackParamList = {
  Home: NavigatorScreenParams<HomeTabParamList>;
  // Phase 0 chrome demos (prove the navigation grammar):
  DetailDemo: undefined; // pushed — leading "‹ back"
  ModalDemo: undefined; // modal — leading "✕ close"
};

declare global {
  // makes useNavigation()/navigation typed without per-call generics
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
