// Language display helpers. People/phrases store `lang` as BCP-47 (pl-PL / uk-UA / ru-RU
// / es-ES / fr-FR / de-DE / ja-JP / ko-KR), but the design mock shows short codes (PL /
// UK / RU…). These map either form to a short badge + full name, tolerant of nulls and
// either style. The same list drives the phrase-creation language picker.

export interface LangInfo {
  code: string; // BCP-47, e.g. 'pl-PL'
  short: string; // 'PL'
  name: string; // 'Polish'
  native: string; // 'Polski'
  /** non-Latin script → a romanised transliteration is shown (Cyrillic / kana / hangul). */
  romanised: boolean;
}

// The languages the app supports, in picker order. (Slavic first — the original set —
// then the broader additions.)
export const LANGUAGES: LangInfo[] = [
  { code: 'pl-PL', short: 'PL', name: 'Polish', native: 'Polski', romanised: false },
  { code: 'uk-UA', short: 'UK', name: 'Ukrainian', native: 'Українська', romanised: true },
  { code: 'ru-RU', short: 'RU', name: 'Russian', native: 'Русский', romanised: true },
  { code: 'es-ES', short: 'ES', name: 'Spanish', native: 'Español', romanised: false },
  { code: 'fr-FR', short: 'FR', name: 'French', native: 'Français', romanised: false },
  { code: 'de-DE', short: 'DE', name: 'German', native: 'Deutsch', romanised: false },
  { code: 'ja-JP', short: 'JA', name: 'Japanese', native: '日本語', romanised: true },
  { code: 'ko-KR', short: 'KO', name: 'Korean', native: '한국어', romanised: true },
  { code: 'zh-CN', short: 'ZH', name: 'Mandarin', native: '中文', romanised: true },
];

// Keyed by the leading 2-letter subtag (lowercased), so 'pl-PL' and 'PL' both resolve.
const BY_PREFIX: Record<string, LangInfo> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code.slice(0, 2).toLowerCase(), l]),
);

function lookup(lang: string | null | undefined): LangInfo | undefined {
  if (!lang) return undefined;
  return BY_PREFIX[lang.slice(0, 2).toLowerCase()];
}

/** Short badge code, e.g. 'PL'. Falls back to the first 2 letters uppercased. */
export function langShort(lang: string | null | undefined): string | null {
  if (!lang) return null;
  return lookup(lang)?.short ?? lang.slice(0, 2).toUpperCase();
}

/** Full name, e.g. 'Polish'. null if unknown/empty. */
export function langName(lang: string | null | undefined): string | null {
  return lookup(lang)?.name ?? null;
}
