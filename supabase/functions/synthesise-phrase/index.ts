// POST /synthesise-phrase — proxies to Google Cloud Text-to-Speech (Wavenet).
// Keeps the service account server-side; the app never sees it.
//
//   Request:  { tgt: string, lang: string /* BCP-47 */, voice_gender?: "male" | "female" }
//   Response: { audio_ref: string /* uuid */, mp3_base64: string }
//
// The client writes mp3_base64 to its cache as {audio_ref}.mp3, uploads the same bytes
// to Storage bucket "phrase-audio" at {user_id}/{audio_ref}.mp3, and stores audio_ref
// on the phrase row. Playback always reads the local cache (§12).
//
// Deploy:  supabase functions deploy synthesise-phrase
// Secret:  supabase secrets set GOOGLE_TTS_SERVICE_ACCOUNT='{"type":"service_account",...}'

import { corsHeaders, json } from '../_shared/cors.ts';

const SA_RAW = Deno.env.get('GOOGLE_TTS_SERVICE_ACCOUNT');

// Wavenet voices (§12). speakingRate 0.95 = slightly slow for learners.
// NOTE: Ukrainian male availability was unverified at build time — falls back to female.
const VOICES: Record<string, { male?: string; female: string }> = {
  'ru-RU': { male: 'ru-RU-Wavenet-D', female: 'ru-RU-Wavenet-A' },
  'pl-PL': { male: 'pl-PL-Wavenet-B', female: 'pl-PL-Wavenet-A' },
  'uk-UA': { female: 'uk-UA-Wavenet-A' },
};
const DEFAULT_GENDER: 'male' | 'female' = 'female';

// --- service-account OAuth (sign a JWT, exchange for an access token) ---------

function b64urlFromString(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function getAccessToken(sa: any): Promise<string> {
  const tokenUri = sa.token_uri ?? 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64urlFromString(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64urlFromBytes(new Uint8Array(sig))}`;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token as string;
}

// --- handler ------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    if (!SA_RAW) return json({ error: 'GOOGLE_TTS_SERVICE_ACCOUNT not configured' }, 500);

    const { tgt, lang, voice_gender } = await req.json();
    if (!tgt || !lang) return json({ error: 'tgt and lang are required' }, 400);

    const langVoices = VOICES[lang];
    if (!langVoices) return json({ error: `unsupported lang: ${lang}` }, 400);
    const gender = (voice_gender as 'male' | 'female') ?? DEFAULT_GENDER;
    const voiceName = (gender === 'male' ? langVoices.male : langVoices.female) ?? langVoices.female;

    const sa = JSON.parse(SA_RAW);
    const token = await getAccessToken(sa);

    const resp = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        input: { text: tgt },
        voice: { languageCode: lang, name: voiceName },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.95 },
      }),
    });

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
