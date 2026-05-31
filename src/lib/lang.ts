// Language display helpers. People/phrases store `lang` as BCP-47 (pl-PL / uk-UA /
// ru-RU) per the schema, but the design mock shows short codes (PL / UK / RU). These
// map either form to a short badge + full name, tolerant of nulls and either style.

export interface LangInfo {
  short: string; // 'PL'
  name: string; // 'Polish'
  native: string; // 'Polski'
}

// Keyed by the leading 2-letter subtag (lowercased), so 'pl-PL' and 'PL' both resolve.
const BY_PREFIX: Record<string, LangInfo> = {
  pl: { short: 'PL', name: 'Polish', native: 'Polski' },
  uk: { short: 'UK', name: 'Ukrainian', native: 'Українська' },
  ru: { short: 'RU', name: 'Russian', native: 'Русский' },
};

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
