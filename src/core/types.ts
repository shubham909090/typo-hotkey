export interface SelectionRange {
  location: number;
  length: number;
}

export interface TextSnapshot {
  text: string;
  selection?: SelectionRange;
  secure?: boolean;
  unsupported?: boolean;
  source?: string;
}

export interface ChangedWord {
  original: string;
  replacement: string;
  start: number;
  end: number;
}

export interface FixTextResult {
  text: string;
  changed: boolean;
  suggestionsChecked: number;
  changedWords: ChangedWord[];
}

export type FixResultStatus =
  | "fixed"
  | "unchanged"
  | "no-focused-text"
  | "secure-field"
  | "unsupported"
  | "error";

export interface FixResult {
  status: FixResultStatus;
  changedWords: ChangedWord[];
  beforeText?: string;
  afterText?: string;
  reason?: string;
}

export interface TypoFixer {
  fixFocusedField(): Promise<FixResult>;
  fixText(text: string): Promise<FixTextResult>;
}

export interface FocusedTextAdapter {
  read(): Promise<TextSnapshot | null>;
  write(next: TextSnapshot): Promise<void>;
}

export interface SpellSuggestionEngine {
  suggestMany(words: string[]): Promise<Record<string, string | null>>;
}
