/**
 * Resolves the language instruction to append to the system prompt based on
 * the configured language mode and request metadata.
 *
 * Modes:
 * - "client": use nupi.lang.english from metadata → "Always respond in {name}."
 *   Falls back to "auto" behavior if metadata is absent.
 * - "auto": always returns the auto-detect instruction.
 * - any other value: operator-defined string passed through as-is →
 *   "Always respond in {value} regardless of the input language."
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

  // Operator-defined value — pass through as-is to the prompt.
  return `Always respond in ${configLang} regardless of the input language.`;
}
