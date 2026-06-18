export interface WordToken {
  text: string;
  key: string;
  start: number;
  end: number;
}

interface Span {
  start: number;
  end: number;
}

const WORD_PATTERN = /[A-Za-z]+(?:['';][A-Za-z]+)?/g;
const PROTECTED_PATTERNS = [
  /```[\s\S]*?```/g,
  /`[^`\n]*`/g,
  /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
];

export function collectFixableWordTokens(text: string): WordToken[] {
  const protectedSpans = collectProtectedSpans(text);
  const tokens: WordToken[] = [];

  for (const match of text.matchAll(WORD_PATTERN)) {
    const word = match[0];
    const start = match.index ?? 0;
    const end = start + word.length;

    if (
      isInsideProtectedSpan(start, end, protectedSpans) ||
      !isFixableToken(text, word, start, end)
    ) {
      continue;
    }

    tokens.push({
      text: word,
      key: normalizeWordForLookup(word),
      start,
      end,
    });
  }

  return tokens;
}

export function normalizeWordForLookup(word: string): string {
  return word.toLocaleLowerCase("en-US").replace(/[']/g, "'");
}

function collectProtectedSpans(text: string): Span[] {
  const spans: Span[] = [];
  for (const pattern of PROTECTED_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      spans.push({ start, end: start + match[0].length });
    }
  }

  return spans.sort((left, right) => left.start - right.start);
}

function isInsideProtectedSpan(start: number, end: number, spans: Span[]): boolean {
  return spans.some((span) => start < span.end && end > span.start);
}

function isFixableToken(text: string, word: string, start: number, end: number): boolean {
  if (word.length < 2) {
    return false;
  }

  if (/^[A-Z]{2,3}$/.test(word)) {
    return false;
  }

  if (/[a-z][A-Z]/.test(word)) {
    return false;
  }

  const previous = text[start - 1] ?? "";
  const next = text[end] ?? "";
  const beforePrevious = text[start - 2] ?? "";
  const afterNext = text[end + 1] ?? "";

  if (isIdentifierNeighbor(previous) || isIdentifierNeighbor(next)) {
    return false;
  }

  if (previous === "." && isAlphaNumeric(beforePrevious)) {
    return false;
  }

  if (next === "." && isAlphaNumeric(afterNext)) {
    return false;
  }

  if ((previous === "-" && isAlphaNumeric(beforePrevious)) || (next === "-" && isAlphaNumeric(afterNext))) {
    return false;
  }

  if (next === "(") {
    return false;
  }

  return true;
}

function isIdentifierNeighbor(value: string): boolean {
  return value === "_" || value === "/" || /[0-9]/.test(value);
}

function isAlphaNumeric(value: string): boolean {
  return /[A-Za-z0-9]/.test(value);
}
