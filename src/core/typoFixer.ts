import { applyOriginalCase } from "./casing.js";
import { applyInlineReplacements } from "./inlineReplacements.js";
import { collectFixableWordTokens } from "./tokenize.js";
import type {
  ChangedWord,
  FixResult,
  FixTextResult,
  FocusedTextAdapter,
  SelectionRange,
  SpellSuggestionEngine,
  TextSnapshot,
  TypoFixer,
} from "./types.js";

export interface TypoFixerDependencies {
  focusedText: FocusedTextAdapter;
  spellSuggestions: SpellSuggestionEngine;
}

export function createTypoFixer(dependencies: TypoFixerDependencies): TypoFixer {
  return new DefaultTypoFixer(dependencies.focusedText, dependencies.spellSuggestions);
}

class DefaultTypoFixer implements TypoFixer {
  constructor(
    private readonly focusedText: FocusedTextAdapter,
    private readonly spellSuggestions: SpellSuggestionEngine,
  ) {}

  async fixFocusedField(): Promise<FixResult> {
    try {
      const snapshot = await this.focusedText.read();

      if (!snapshot) {
        return emptyFocusedResult("no-focused-text", "No focused editable text field.");
      }

      if (snapshot.secure) {
        return emptyFocusedResult("secure-field", "Focused field is secure.");
      }

      if (snapshot.unsupported) {
        return emptyFocusedResult("unsupported", "Focused field does not expose editable text.");
      }

      const fixed = await this.fixText(snapshot.text);
      if (!fixed.changed) {
        return {
          status: "unchanged",
          changedWords: [],
          beforeText: snapshot.text,
          afterText: snapshot.text,
        };
      }

      await this.focusedText.write({
        ...snapshot,
        text: fixed.text,
        selection: adjustSelection(snapshot.selection, fixed.changedWords),
      });

      return {
        status: "fixed",
        changedWords: fixed.changedWords,
        beforeText: snapshot.text,
        afterText: fixed.text,
      };
    } catch (error) {
      return {
        status: "error",
        changedWords: [],
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async fixText(text: string): Promise<FixTextResult> {
    const inline = applyInlineReplacements(text);
    const baseText = inline.text;
    const tokens = collectFixableWordTokens(baseText);
    const wordsToCheck = [...new Set(tokens.map((token) => token.key))];

    if (wordsToCheck.length === 0) {
      return {
        text: baseText,
        changed: inline.changedWords.length > 0,
        suggestionsChecked: 0,
        changedWords: inline.changedWords,
      };
    }

    const suggestions = await this.spellSuggestions.suggestMany(wordsToCheck);
    const changedWords: ChangedWord[] = [...inline.changedWords];
    let output = "";
    let cursor = 0;

    for (const token of tokens) {
      const suggestion = suggestions[token.key];
      if (!isUsableSuggestion(token.key, suggestion)) {
        continue;
      }

      const replacement = applyOriginalCase(token.text, suggestion);
      if (replacement === token.text) {
        continue;
      }

      output += baseText.slice(cursor, token.start);
      output += replacement;
      cursor = token.end;
      changedWords.push({
        original: token.text,
        replacement,
        start: token.start,
        end: token.end,
      });
    }

    if (changedWords.length === 0) {
      return {
        text: baseText,
        changed: false,
        suggestionsChecked: wordsToCheck.length,
        changedWords: [],
      };
    }

    output += baseText.slice(cursor);

    return {
      text: output,
      changed: true,
      suggestionsChecked: wordsToCheck.length,
      changedWords,
    };
  }
}

function emptyFocusedResult(status: FixResult["status"], reason: string): FixResult {
  return {
    status,
    changedWords: [],
    reason,
  };
}

function isUsableSuggestion(word: string, suggestion: string | null | undefined): suggestion is string {
  if (!suggestion) {
    return false;
  }

  const trimmed = suggestion.trim();
  return trimmed.length > 0 && !/\s/.test(trimmed) && trimmed.toLocaleLowerCase("en-US") !== word;
}

function adjustSelection(
  selection: SelectionRange | undefined,
  changes: ChangedWord[],
): SelectionRange | undefined {
  if (!selection) {
    return undefined;
  }

  const start = mapOffset(selection.location, changes);
  const end = mapOffset(selection.location + selection.length, changes);

  return {
    location: start,
    length: Math.max(0, end - start),
  };
}

function mapOffset(offset: number, changes: ChangedWord[]): number {
  let mapped = offset;

  for (const change of changes) {
    const delta = change.replacement.length - change.original.length;

    if (change.end <= offset) {
      mapped += delta;
      continue;
    }

    if (change.start < offset) {
      mapped = change.start + change.replacement.length;
    }
  }

  return Math.max(0, mapped);
}
