import type { ChangedWord } from "./types.js";

const INLINE_REPLACEMENTS = new Map<string, string>([
  ["don;t", "don't"],
  ["doesn;t", "doesn't"],
  ["didn;t", "didn't"],
  ["can;t", "can't"],
  ["couldn;t", "couldn't"],
  ["shouldn;t", "shouldn't"],
  ["wouldn;t", "wouldn't"],
  ["won;t", "won't"],
  ["isn;t", "isn't"],
  ["aren;t", "aren't"],
  ["wasn;t", "wasn't"],
  ["weren;t", "weren't"],
  ["it;s", "it's"],
  ["that;s", "that's"],
  ["there;s", "there's"],
  ["what;s", "what's"],
  ["i;m", "I'm"],
]);

const INLINE_PATTERN = /[A-Za-z]+;[A-Za-z]+/g;

export interface InlineReplacementResult {
  text: string;
  changedWords: ChangedWord[];
}

export function applyInlineReplacements(text: string): InlineReplacementResult {
  const changedWords: ChangedWord[] = [];
  let output = "";
  let cursor = 0;

  const replacements = collectSemicolonReplacements(text).sort(
    (left, right) => left.start - right.start,
  );

  for (const replacement of replacements) {
    if (replacement.start < cursor) {
      continue;
    }

    output += text.slice(cursor, replacement.start);
    output += replacement.replacement;
    cursor = replacement.end;
    changedWords.push(replacement);
  }

  if (changedWords.length === 0) {
    return { text, changedWords };
  }

  output += text.slice(cursor);
  return { text: output, changedWords };
}

function collectSemicolonReplacements(text: string): ChangedWord[] {
  const replacements: ChangedWord[] = [];

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const original = match[0];
    const replacement = INLINE_REPLACEMENTS.get(original.toLocaleLowerCase("en-US"));
    if (!replacement) {
      continue;
    }

    const start = match.index ?? 0;
    const end = start + original.length;
    replacements.push({ original, replacement, start, end });
  }

  return replacements;
}
