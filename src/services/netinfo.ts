// Connectivity awareness (NetInfo) exposed as a tiny global store + subscription.
// Sync and the §12 background workers react to "online"; the UI never blocks on it.

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

type Listener = (online: boolean) => void;

let _online = true; // optimistic until the first event
const listeners = new Set<Listener>();

export function isOnline(): boolean {
  return _online;
}

export function onConnectivityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function deriveOnline(state: NetInfoState): boolean {
  // isInternetReachable can be null while probing — treat null as "connected".
  return !!state.isConnected && state.isInternetReachable !== false;
}

/** Wire NetInfo. Call once at app start; returns an unsubscribe fn. */
export function initConnectivity(): () => void {
  NetInfo.fetch().then((s) => {
    _online = deriveOnline(s);
  });
  return NetInfo.addEventListener((state) => {
    const next = deriveOnline(state);
    if (next !== _online) {
      _online = next;
      console.log(`[net] ${next ? 'online' : 'offline'}`);
      listeners.forEach((l) => l(next));
    }
  });
}
