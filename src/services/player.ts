// A single shared audio player (react-native-nitro-sound). Phrase ▶ buttons all route
// here; starting a new clip stops any current one. The cache file is resolved first
// (writing it from Storage if needed), then played from its path — base64 data-URI
// playback is unreliable on iOS, so we always play a real file.

import Sound from 'react-native-nitro-sound';
import { cachedAudioPath } from './audioCache';
import { restoreAudioFromStorage } from './tts';

let currentRef: string | null = null;
let listeners = new Set<(playingRef: string | null) => void>();

function setPlaying(ref: string | null): void {
  currentRef = ref;
  for (const l of listeners) l(ref);
}

/** subscribe to "which audio_ref is playing" (null = nothing). returns an unsubscribe. */
export function subscribePlayer(fn: (playingRef: string | null) => void): () => void {
  listeners.add(fn);
  fn(currentRef);
  return () => {
    listeners.delete(fn);
  };
}

export const playingRef = (): string | null => currentRef;

/** Play the clip for an audio_ref. Resolves the local cache (restoring from Storage if
 *  missing). No-op (returns false) if the audio isn't available. Toggling the same ref
 *  while it plays stops it. */
export async function playAudio(audioRef: string | null | undefined): Promise<boolean> {
  if (!audioRef) return false;

  // toggle off if this same clip is playing
  if (currentRef === audioRef) {
    await stopAudio();
    return true;
  }

  let path = await cachedAudioPath(audioRef);
  if (!path) path = await restoreAudioFromStorage(audioRef);
  if (!path) return false;

  try {
    if (currentRef) await Sound.stopPlayer().catch(() => {});
    Sound.addPlaybackEndListener(() => {
      Sound.removePlaybackEndListener();
      setPlaying(null);
    });
    setPlaying(audioRef);
    await Sound.startPlayer(path);
    return true;
  } catch (e) {
    console.warn('[player] play failed:', (e as Error).message);
    setPlaying(null);
    return false;
  }
}

export async function stopAudio(): Promise<void> {
  try {
    await Sound.stopPlayer();
    Sound.removePlaybackEndListener();
  } catch {
    // ignore
  }
  setPlaying(null);
}
