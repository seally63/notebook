// On-device mp3 cache for phrase audio (§12: playback always reads the local cache).
// Files live under <Caches>/phrase-audio/<audio_ref>.mp3. The cache is disposable —
// Storage is the source of truth for cross-device restore.

import { CachesDirectoryPath, exists, mkdir, writeFile, unlink } from '@dr.pogodin/react-native-fs';

const DIR = `${CachesDirectoryPath}/phrase-audio`;

export const audioCachePath = (audioRef: string): string => `${DIR}/${audioRef}.mp3`;

async function ensureDir(): Promise<void> {
  if (!(await exists(DIR))) await mkdir(DIR);
}

/** Write base64 mp3 bytes to the cache; returns the file path. */
export async function writeAudioCache(audioRef: string, mp3Base64: string): Promise<string> {
  await ensureDir();
  const path = audioCachePath(audioRef);
  await writeFile(path, mp3Base64, 'base64');
  return path;
}

/** Local cache path if present, else null. */
export async function cachedAudioPath(audioRef: string): Promise<string | null> {
  const path = audioCachePath(audioRef);
  return (await exists(path)) ? path : null;
}

export async function removeAudioCache(audioRef: string): Promise<void> {
  const path = audioCachePath(audioRef);
  if (await exists(path)) await unlink(path);
}
