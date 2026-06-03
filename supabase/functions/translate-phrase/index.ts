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

// System message (§12). Translates faithfully — NO register editorialising, NO suggesting
// "less crude" alternatives. When the phrase changes form by the SPEAKER's gender (common
// in Slavic past tense / adjectives), it returns both forms as `variants`.
const SYSTEM = `You translate short conversational phrases for an English speaker learning
to speak a language (Polish, Ukrainian, or Russian). Return ONLY valid JSON:

{
  "tgt": string,            // the phrase in native script (Cyrillic for ru/uk, Latin for pl).
                            // Use the masculine speaker form here if the phrase is gendered.
  "tgt_romanised": string | null,
                            // Latin transliteration of tgt; null for Polish (already Latin).
  "register": "informal" | "neutral" | "formal",  // the register you actually used.
  "variants": [             // ONLY when the phrase changes with the SPEAKER's gender
                            // (e.g. past-tense verbs, adjectives). Omit or use [] otherwise.
    { "gender": "male",   "tgt": string, "romanised": string | null },
    { "gender": "female", "tgt": string, "romanised": string | null }
  ],
  "note": string | null     // a SHORT neutral grammar note ONLY if needed to use the forms
                            // (e.g. "past tense changes with speaker's gender"). Else null.
}

Rules:
- Translate FAITHFULLY and literally in tone. Preserve slang, profanity, and crudeness
  EXACTLY as written — never soften, censor, or suggest a politer alternative. The user's
  wording is deliberate.
- Choose the most natural phrasing for the meaning; default to informal register.
- Gender = the GENDER OF THE SPEAKER (the person saying it), not who they're talking to.
  Only populate "variants" when the two forms genuinely differ; otherwise omit it.
- "note" is for grammar only, never for register/politeness commentary or alternatives.
- No text outside the JSON.`;

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

    // normalise variants → [{gender, tgt, romanised}] for male/female, only if both differ
    let variants: Array<{ gender: string; tgt: string; romanised: string | null }> = [];
    if (Array.isArray(parsed.variants)) {
      variants = parsed.variants
        .filter((v: any) => v && v.tgt && (v.gender === 'male' || v.gender === 'female'))
        .map((v: any) => ({ gender: v.gender, tgt: String(v.tgt), romanised: v.romanised ?? null }));
      const uniqueForms = new Set(variants.map((v) => v.tgt));
      if (variants.length < 2 || uniqueForms.size < 2) variants = []; // not actually gendered
    }

    return json({
      tgt: parsed.tgt ?? null,
      tgt_romanised: parsed.tgt_romanised ?? null,
      register: parsed.register ?? 'neutral',
      variants,
      note: parsed.note ?? null,
    });
  } catch (e) {
    return json({ error: (e as Error).message ?? String(e) }, 500);
  }
});
