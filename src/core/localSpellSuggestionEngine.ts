import dictionary from "dictionary-en";
import nspell from "nspell";
import type { SpellSuggestionEngine } from "./types.js";

const ALPHABET = Array.from("abcdefghijklmnopqrstuvwxyz");
const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const MAX_CANDIDATES = 80;
const MAX_SUGGESTION_RANK = 16;

interface Candidate {
  value: string;
  source: "native-list" | "generated";
  rank: number;
}

export class LocalSpellSuggestionEngine implements SpellSuggestionEngine {
  private readonly spell = nspell(dictionary);

  async suggestMany(words: string[]): Promise<Record<string, string | null>> {
    return Object.fromEntries(words.map((word) => [word, this.suggest(word)]));
  }

  suggestHighConfidence(word: string): string | null {
    const normalized = word.toLocaleLowerCase("en-US");
    if (/^[a-z]+$/.test(normalized) && normalized.startsWith("u") && normalized.length > 3) {
      const unWord = `un${normalized.slice(1)}`;
      if (this.spell.correct(unWord)) {
        return unWord;
      }
    }

    return null;
  }

  choosePreferredSuggestion(
    word: string,
    primarySuggestion: string | null | undefined,
    localSuggestion: string | null | undefined,
  ): string | null {
    if (!primarySuggestion) {
      return localSuggestion ?? null;
    }

    if (!localSuggestion) {
      return primarySuggestion;
    }

    const normalized = word.toLocaleLowerCase("en-US");
    const normalizedPrimary = normalizeDictionarySuggestion(primarySuggestion);
    const normalizedLocal = normalizeDictionarySuggestion(localSuggestion);
    if (!normalizedPrimary || !normalizedLocal || normalizedPrimary === normalizedLocal) {
      return primarySuggestion;
    }

    const primaryScore = scoreCandidate(normalized, {
      value: normalizedPrimary,
      source: "native-list",
      rank: 0,
    });
    const localScore = scoreCandidate(normalized, {
      value: normalizedLocal,
      source: "generated",
      rank: 0,
    });

    return localScore + 12 < primaryScore ? localSuggestion : primarySuggestion;
  }

  private suggest(word: string): string | null {
    const highConfidence = this.suggestHighConfidence(word);
    if (highConfidence) {
      return highConfidence;
    }

    const normalized = word.toLocaleLowerCase("en-US");
    if (!/^[a-z]+$/.test(normalized) || this.spell.correct(word) || this.spell.correct(normalized)) {
      return null;
    }

    const candidates = this.collectCandidates(normalized);
    const best = candidates
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(normalized, candidate),
      }))
      .sort((left, right) => left.score - right.score)
      .at(0);

    if (!best || !isConfidentCorrection(normalized, best.candidate.value, best.score)) {
      return null;
    }

    return best.candidate.value;
  }

  private collectCandidates(word: string): Candidate[] {
    const candidates = new Map<string, Candidate>();

    for (const [rank, suggestion] of this.spell.suggest(word).entries()) {
      if (rank >= MAX_SUGGESTION_RANK) {
        break;
      }

      const normalizedSuggestion = normalizeDictionarySuggestion(suggestion);
      if (
        !normalizedSuggestion ||
        normalizedSuggestion === word ||
        !this.spell.correct(normalizedSuggestion)
      ) {
        continue;
      }

      candidates.set(normalizedSuggestion, {
        value: normalizedSuggestion,
        source: "native-list",
        rank,
      });
    }

    for (const generated of generateSingleEditCandidates(word)) {
      if (
        generated === word ||
        candidates.size >= MAX_CANDIDATES ||
        !this.spell.correct(generated)
      ) {
        continue;
      }

      const existing = candidates.get(generated);
      candidates.set(generated, {
        value: generated,
        source: "generated",
        rank: existing?.rank ?? MAX_SUGGESTION_RANK,
      });
    }

    return [...candidates.values()];
  }
}

function normalizeDictionarySuggestion(suggestion: string): string | null {
  const trimmed = suggestion.trim();
  if (!/^[A-Za-z']+$/.test(trimmed)) {
    return null;
  }

  const letters = trimmed.replace(/'/g, "");
  if (letters.length > 1 && letters === letters.toLocaleUpperCase("en-US")) {
    return null;
  }

  return trimmed.toLocaleLowerCase("en-US");
}

function generateSingleEditCandidates(word: string): Set<string> {
  const candidates = new Set<string>();

  for (let index = 0; index < word.length; index += 1) {
    candidates.add(`${word.slice(0, index)}${word.slice(index + 1)}`);
  }

  for (let index = 0; index < word.length - 1; index += 1) {
    if (word[index] === word[index + 1]) {
      continue;
    }

    candidates.add(
      `${word.slice(0, index)}${word[index + 1]}${word[index]}${word.slice(index + 2)}`,
    );
  }

  for (let index = 0; index < word.length; index += 1) {
    for (const replacement of replacementLettersFor(word[index] ?? "")) {
      candidates.add(`${word.slice(0, index)}${replacement}${word.slice(index + 1)}`);
    }
  }

  for (let index = 0; index <= word.length; index += 1) {
    for (const letter of ALPHABET) {
      candidates.add(`${word.slice(0, index)}${letter}${word.slice(index)}`);
    }
  }

  return candidates;
}

function replacementLettersFor(letter: string): string[] {
  const replacements = new Set<string>(keyboardNeighbors(letter));
  if (VOWELS.has(letter)) {
    for (const vowel of VOWELS) {
      replacements.add(vowel);
    }
  }

  replacements.delete(letter);
  return [...replacements];
}

function keyboardNeighbors(letter: string): string[] {
  const rowOffsets = [
    ["qwertyuiop", 0],
    ["asdfghjkl", 0.5],
    ["zxcvbnm", 1],
  ] as const;
  const source = keyPosition(letter, rowOffsets);
  if (!source) {
    return [];
  }

  const neighbors: string[] = [];
  for (const row of rowOffsets) {
    for (const [index, candidate] of Array.from(row[0]).entries()) {
      if (candidate === letter) {
        continue;
      }

      const distance = Math.hypot(source.x - (index + row[1]), source.y - rowOffsets.indexOf(row));
      if (distance <= 1.25) {
        neighbors.push(candidate);
      }
    }
  }

  return neighbors;
}

function keyPosition(
  letter: string,
  rows: readonly (readonly [row: string, offset: number])[],
): { x: number; y: number } | null {
  for (const [rowIndex, row] of rows.entries()) {
    const columnIndex = row[0].indexOf(letter);
    if (columnIndex >= 0) {
      return { x: columnIndex + row[1], y: rowIndex };
    }
  }

  return null;
}

function scoreCandidate(word: string, candidate: Candidate): number {
  const value = candidate.value;
  let score = weightedEditDistance(word, value) * 100;
  score += Math.abs(word.length - value.length) * 3;
  score += candidate.rank * (candidate.source === "native-list" ? 4 : 0.25);

  const prefix = commonPrefixLength(word, value);
  const suffix = commonSuffixLength(word, value);
  score -= Math.min(prefix, 4) * 8;
  score -= Math.min(suffix, 4) * 7;

  if (word[0] === value[0]) {
    score -= 8;
  }

  if (word.at(-1) === value.at(-1)) {
    score -= 14;
  }

  const inserted = singleInsertedLetter(word, value);
  if (inserted && inserted.letter === "c" && value[inserted.index + 1] === "k") {
    score -= 18;
  } else if (inserted && inserted.index > 0 && value[inserted.index + 1] === "k") {
    score += 10;
  }

  return score;
}

function isConfidentCorrection(word: string, suggestion: string, score: number): boolean {
  const lengthDelta = Math.abs(word.length - suggestion.length);
  if (lengthDelta > 2) {
    return false;
  }

  return score <= Math.max(92, word.length * 18);
}

function weightedEditDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const distance = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) {
    distance[row]![0] = row * deletionCost(left[row - 1] ?? "");
  }

  for (let column = 0; column < columns; column += 1) {
    distance[0]![column] = column * insertionCost(right[column - 1] ?? "");
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const leftChar = left[row - 1] ?? "";
      const rightChar = right[column - 1] ?? "";
      const substitution = distance[row - 1]![column - 1]! + substitutionCost(leftChar, rightChar);
      const deletion = distance[row - 1]![column]! + deletionCost(leftChar);
      const insertion = distance[row]![column - 1]! + insertionCost(rightChar);
      let best = Math.min(substitution, deletion, insertion);

      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        best = Math.min(best, distance[row - 2]![column - 2]! + 0.55);
      }

      distance[row]![column] = best;
    }
  }

  return distance[left.length]![right.length]!;
}

function insertionCost(letter: string): number {
  return VOWELS.has(letter) ? 0.95 : 0.82;
}

function deletionCost(letter: string): number {
  return VOWELS.has(letter) ? 0.95 : 0.82;
}

function substitutionCost(left: string, right: string): number {
  if (left === right) {
    return 0;
  }

  if (keyboardNeighbors(left).includes(right)) {
    return 0.72;
  }

  if (VOWELS.has(left) && VOWELS.has(right)) {
    return 0.82;
  }

  return 1.12;
}

function commonPrefixLength(left: string, right: string): number {
  let count = 0;
  while (count < left.length && count < right.length && left[count] === right[count]) {
    count += 1;
  }

  return count;
}

function commonSuffixLength(left: string, right: string): number {
  let count = 0;
  while (
    count < left.length &&
    count < right.length &&
    left[left.length - 1 - count] === right[right.length - 1 - count]
  ) {
    count += 1;
  }

  return count;
}

function singleInsertedLetter(source: string, candidate: string): { letter: string; index: number } | null {
  if (candidate.length !== source.length + 1) {
    return null;
  }

  for (let index = 0; index < candidate.length; index += 1) {
    if (`${candidate.slice(0, index)}${candidate.slice(index + 1)}` === source) {
      return { letter: candidate[index] ?? "", index };
    }
  }

  return null;
}
