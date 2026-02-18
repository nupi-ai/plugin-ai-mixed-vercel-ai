/**
 * Resolves the language instruction to append to the system prompt based on
 * the configured language mode and request metadata.
 *
 * Modes:
 * - "client": use nupi.lang.english from metadata → "Always respond in {name}."
 *   Falls back to "auto" behavior if metadata is absent.
 * - "auto": always returns the auto-detect instruction.
 * - any other value: treated as specific ISO 639-1 code → "Always respond in {name}
 *   regardless of the input language."
 *
 * Returns an empty string when no instruction should be appended.
 */
export function resolveLanguageInstruction(
  configLang: string,
  metadata: Record<string, string> | undefined | null
): string {
  if (configLang === 'client') {
    const englishName = metadata?.['nupi.lang.english']?.trim();
    if (englishName) {
      return `Always respond in ${englishName}.`;
    }
    // No metadata → no instruction added (AI responds naturally without language constraint)
    return '';
  }

  if (configLang === 'auto') {
    return "Detect the language of the user's message and respond in the same language.";
  }

  // Specific ISO 639-1 code → resolve to English name
  const name = isoToEnglish(configLang);
  return `Always respond in ${name} regardless of the input language.`;
}

/** Maps common ISO 639-1 codes to English names. */
const ISO_NAMES: Record<string, string> = {
  en: 'English',
  pl: 'Polish',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ru: 'Russian',
  uk: 'Ukrainian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  cs: 'Czech',
  sk: 'Slovak',
  hu: 'Hungarian',
  ro: 'Romanian',
  bg: 'Bulgarian',
  hr: 'Croatian',
  el: 'Greek',
  he: 'Hebrew',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
};

function isoToEnglish(code: string): string {
  return ISO_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}
