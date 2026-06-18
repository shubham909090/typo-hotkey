import { LocalSpellSuggestionEngine } from "./localSpellSuggestionEngine.js";
import type { SpellSuggestionEngine } from "./types.js";

export class HybridSpellSuggestionEngine implements SpellSuggestionEngine {
  constructor(
    private readonly primary: SpellSuggestionEngine,
    private readonly local: LocalSpellSuggestionEngine,
  ) {}

  async suggestMany(words: string[]): Promise<Record<string, string | null>> {
    const highConfidence = new Map<string, string>();
    const primaryWords: string[] = [];

    for (const word of words) {
      const localSuggestion = this.local.suggestHighConfidence(word);
      if (localSuggestion) {
        highConfidence.set(word, localSuggestion);
      } else {
        primaryWords.push(word);
      }
    }

    const primarySuggestions =
      primaryWords.length > 0 ? await this.primary.suggestMany(primaryWords) : {};
    const localSuggestions =
      primaryWords.length > 0 ? await this.local.suggestMany(primaryWords) : {};

    return Object.fromEntries(
      words.map((word) => {
        const earlySuggestion = highConfidence.get(word);
        if (earlySuggestion) {
          return [word, earlySuggestion];
        }

        return [
          word,
          this.local.choosePreferredSuggestion(
            word,
            primarySuggestions[word],
            localSuggestions[word],
          ),
        ];
      }),
    );
  }
}
