// Translation service (§12). Proxies to the `translate-phrase` Edge Function (Anthropic
// Claude Haiku 4.5) via supabase-js. The API key lives server-side only. Returns null on
// any failure (offline, not configured, function error) so callers fall back to the
// pending/manual path — translation is never blocking.

import { getSupabase, invokeFn } from './supabase';

export interface TranslateResult {
  tgt: string;
  tgt_romanised: string | null;
  register: 'informal' | 'neutral' | 'formal' | null;
  variants: { gender: 'male' | 'female'; tgt: string; romanised: string | null }[];
  note: string | null;
}

export async function translatePhrase(input: {
  en: string;
  targetLang: string; // BCP-47, e.g. 'pl-PL'
  forPersonContext?: string | null;
}): Promise<TranslateResult | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  // guard locally — the function 400s on a missing lang, so never even call it
  if (!input.en?.trim() || !input.targetLang) {
    console.warn('[translate] skipped: missing en/targetLang', { en: input.en, lang: input.targetLang });
    return null;
  }
  try {
    const { data, error } = await invokeFn('translate-phrase', {
      en: input.en.trim(),
      target_lang: input.targetLang,
      for_person_context: input.forPersonContext ?? undefined,
    });
    if (error) {
      // supabase-js hides the HTTP body on FunctionsHttpError — dig it out for real diagnostics
      let detail = error.message;
      try {
        const res = (error as { context?: Response }).context;
        if (res && typeof res.text === 'function') detail = `${res.status}: ${await res.text()}`;
      } catch {
        /* ignore */
      }
      console.warn('[translate] failed:', detail);
      return null;
    }
    if (!data || !data.tgt) {
      console.warn('[translate] no tgt:', data?.note ?? data?.error ?? 'empty response');
      return null;
    }
    return {
      tgt: data.tgt,
      tgt_romanised: data.tgt_romanised ?? null,
      register: data.register ?? null,
      variants: Array.isArray(data.variants) ? data.variants : [],
      note: data.note ?? null,
    };
  } catch (e) {
    console.warn('[translate] threw:', (e as Error).message);
    return null;
  }
}
