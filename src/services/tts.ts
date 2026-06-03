// Text-to-speech service (§12). Proxies to the `synthesise-phrase` Edge Function (Google
// Cloud TTS) via supabase-js, then caches the mp3 on-device and (best-effort) uploads it
// to the private `phrase-audio` Storage bucket for cross-device restore. Returns the
// audio_ref on success, null on any failure (callers leave pending_audio=1 to retry).

import { getSupabase, invokeFn } from './supabase';
import { getCurrentUserId } from '../data/session';
import { writeAudioCache, audioCachePath } from './audioCache';

export interface SynthResult {
  audioRef: string;
  path: string; // local cache file path
}

const SUPPORTED = new Set(['pl-PL', 'uk-UA', 'ru-RU']);

export function ttsSupportsLang(lang: string | null | undefined): boolean {
  return !!lang && SUPPORTED.has(lang);
}

export async function synthesisePhrase(input: {
  tgt: string;
  lang: string; // BCP-47
  voiceGender?: 'male' | 'female';
}): Promise<SynthResult | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  if (!input.tgt?.trim() || !ttsSupportsLang(input.lang)) return null;
  try {
    const { data, error } = await invokeFn('synthesise-phrase', {
      tgt: input.tgt,
      lang: input.lang,
      voice_gender: input.voiceGender ?? undefined,
    });
    if (error) {
      let detail = error.message;
      try {
        const res = (error as { context?: Response }).context;
        if (res && typeof res.text === 'function') detail = `${res.status}: ${await res.text()}`;
      } catch {
        /* ignore */
      }
      console.warn('[tts] failed:', detail);
      return null;
    }
    if (!data || !data.mp3_base64 || !data.audio_ref) {
      console.warn('[tts] no audio:', data?.error ?? 'empty response');
      return null;
    }
    const audioRef: string = data.audio_ref;
    // write to local cache (playback always reads the cache — §12)
    const path = await writeAudioCache(audioRef, data.mp3_base64);
    // best-effort upload to Storage for cross-device restore; never blocks playback
    void uploadToStorage(audioRef, data.mp3_base64);
    return { audioRef, path };
  } catch (e) {
    console.warn('[tts] threw:', (e as Error).message);
    return null;
  }
}

async function uploadToStorage(audioRef: string, mp3Base64: string): Promise<void> {
  const supabase = getSupabase();
  const uid = getCurrentUserId();
  if (!supabase || !uid) return; // only when signed in (RLS path is {uid}/...)
  try {
    const bytes = base64ToBytes(mp3Base64);
    const { error } = await supabase.storage
      .from('phrase-audio')
      .upload(`${uid}/${audioRef}.mp3`, bytes, { contentType: 'audio/mpeg', upsert: true });
    if (error) console.warn('[tts] storage upload:', error.message);
  } catch (e) {
    console.warn('[tts] storage threw:', (e as Error).message);
  }
}

/** Download an mp3 from Storage into the local cache (cross-device restore). Returns the
 *  cache path, or null if unavailable. Used when a synced phrase has an audio_ref but no
 *  local file yet. */
export async function restoreAudioFromStorage(audioRef: string): Promise<string | null> {
  const supabase = getSupabase();
  const uid = getCurrentUserId();
  if (!supabase || !uid) return null;
  try {
    const { data, error } = await supabase.storage.from('phrase-audio').download(`${uid}/${audioRef}.mp3`);
    if (error || !data) return null;
    const b64 = await blobToBase64(data);
    return writeAudioCache(audioRef, b64);
  } catch {
    return null;
  }
}

export { audioCachePath };

// --- base64 helpers (no Buffer in RN) ---------------------------------------
function base64ToBytes(b64: string): Uint8Array {
  const atobFn = (globalThis as { atob?: (s: string) => string }).atob;
  const bin = atobFn ? atobFn(b64) : decodeBase64(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Fallback base64 decoder (atob is polyfilled by react-native-url-polyfill, but guard).
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decodeBase64(input: string): string {
  let str = input.replace(/=+$/, '');
  let output = '';
  for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++)); ) {
    const idx = B64.indexOf(buffer);
    if (idx === -1) continue;
    bs = bc % 4 ? bs * 64 + idx : idx;
    if (bc++ % 4) output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
  }
  return output;
}
