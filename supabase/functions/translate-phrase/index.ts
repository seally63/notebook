// POST /translate-phrase — proxies to the Anthropic API (Claude Haiku 4.5).
// Keeps ANTHROPIC_API_KEY server-side; the app never sees it.
//
//   Request:  { en: string, target_lang: string /* BCP-47 */, for_person_context?: string }
//   Response: { tgt, tgt_romanised, register, note }
//
// Deploy:  supabase functions deploy translate-phrase
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { corsHeaders, json } from '../_shared/cors.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MODEL = 'claude-haiku-4-5-20251001';

// System message — verbatim from the §12 build spec.
const SYSTEM = `You translate short conversational phrases for an English speaker
learning to talk to colleagues in their native language. Return
ONLY valid JSON matching this schema:

{
  "tgt": string,           // the phrase in the target language's
                           // native script (Cyrillic for Russian/
                           // Ukrainian, Latin for Polish)
  "tgt_romanised": string | null,
                           // Latin-script transliteration of tgt;
                           // null for Polish (already Latin)
  "register": "informal" | "neutral" | "formal",
                           // the register chosen — phrases for
                           // workmates should default to "informal"
  "note": string | null    // optional one-line usage note when the
                           // English is ambiguous; null otherwise
}

Rules:
- Choose the most natural workplace phrasing, not a literal
  word-for-word translation.
- Default to informal register for peers/colleagues unless the
  provided context says otherwise.
- No commentary outside the JSON.`;

// Pull the first JSON object out of the model's text (handles ```json fences).
function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON in model response');
  return JSON.parse(raw.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  try {
    if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

    const { en, target_lang, for_person_context } = await req.json();
    if (!en || !target_lang) return json({ error: 'en and target_lang are required' }, 400);

    const userContent =
      `English phrase: ${en}\n` +
      `Target language (BCP-47): ${target_lang}` +
      (for_person_context ? `\nWho it's for / context: ${for_person_context}` : '');

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        temperature: 0, // consistency across retries (§12)
        system: SYSTEM,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return json({ error: `anthropic ${resp.status}`, detail }, 502);
    }

    const data = await resp.json();
    const text = data?.content?.[0]?.text ?? '';
    const parsed = extractJson(text);

    return json({
      tgt: parsed.tgt ?? null,
      tgt_romanised: parsed.tgt_romanised ?? null,
      register: parsed.register ?? 'neutral',
      note: parsed.note ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
