// POST /synthesise-phrase — proxies to Google Cloud Text-to-Speech (Wavenet).
// Authenticated with a Google API key (kept server-side; the app never sees it).
//
//   Request:  { tgt: string, lang: string /* BCP-47 */, voice_gender?: "male" | "female" }
//   Response: { audio_ref: string /* uuid */, mp3_base64: string, voice: string }
//
// The client writes mp3_base64 to its cache as {audio_ref}.mp3, uploads the same bytes
// to Storage bucket "phrase-audio" at {user_id}/{audio_ref}.mp3, and stores audio_ref
// on the phrase row. Playback always reads the local cache (§12).
//
// We use an API key (not a service-account JSON) because newer Google Cloud orgs enforce
// the "Secure by Default" policy iam.disableServiceAccountKeyCreation, which blocks SA key
// downloads. Cloud TTS supports API-key auth on text:synthesize, so this avoids that
// entirely — and needs no JWT signing. Restrict the key to the Cloud Text-to-Speech API.
//
// Deploy:  supabase functions deploy synthesise-phrase
// Secret:  supabase secrets set GOOGLE_TTS_API_KEY=AIza...

import { corsHeaders, json } from '../_shared/cors.ts';

const API_KEY = Deno.env.get('GOOGLE_TTS_API_KEY');

// Explicit Wavenet voice names for the original Slavic set (proven). speakingRate 0.95 =
// slightly slow for learners. For other supported languages we DON'T hardcode a voice
// name — we pass languageCode + ssmlGender and let Google pick the best available voice.
// That avoids 502s from a voice name that gets renamed/retired, and keeps the function
// resilient as Google's catalogue evolves.
const VOICES: Record<string, { male?: string; female: string }> = {
  'ru-RU': { male: 'ru-RU-Wavenet-D', female: 'ru-RU-Wavenet-A' },
  'pl-PL': { male: 'pl-PL-Wavenet-B', female: 'pl-PL-Wavenet-A' },
  'uk-UA': { female: 'uk-UA-Wavenet-A' },
};

// Languages we accept (must mirror the app's ttsSupportsLang / LANGUAGES list).
const SUPPORTED = new Set(['ru-RU', 'pl-PL', 'uk-UA', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'ko-KR', 'zh-CN']);
const DEFAULT_GENDER: 'male' | 'female' = 'female';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    if (!API_KEY) return json({ error: 'GOOGLE_TTS_API_KEY not configured' }, 500);

    const { tgt, lang, voice_gender } = await req.json();
    if (!tgt || !lang) return json({ error: 'tgt and lang are required' }, 400);

    if (!SUPPORTED.has(lang)) return json({ error: `unsupported lang: ${lang}` }, 400);
    const gender = (voice_gender as 'male' | 'female') ?? DEFAULT_GENDER;

    // Prefer an explicit Wavenet name when we have one; otherwise let Google choose by
    // languageCode + gender (the `voice.name` field is simply omitted).
    const langVoices = VOICES[lang];
    const voiceName = langVoices ? (gender === 'male' ? langVoices.male : langVoices.female) ?? langVoices.female : undefined;
    const voice: Record<string, unknown> = { languageCode: lang, ssmlGender: gender.toUpperCase() };
    if (voiceName) voice.name = voiceName;

    const resp = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(API_KEY)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: { text: tgt },
          voice,
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 },
        }),
      },
    );

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: `google-tts ${resp.status}`, detail }, 502);
    }

    const data = await resp.json();
    if (!data.audioContent) return json({ error: 'no audioContent in TTS response' }, 502);

    return json({ audio_ref: crypto.randomUUID(), mp3_base64: data.audioContent, voice: voiceName });
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
