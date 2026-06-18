export { createTypoFixer } from "./core/typoFixer.js";
export { HybridSpellSuggestionEngine } from "./core/hybridSpellSuggestionEngine.js";
export { LocalSpellSuggestionEngine } from "./core/localSpellSuggestionEngine.js";
export { MacNativeBridge } from "./native/MacNativeBridge.js";
export type {
  ChangedWord,
  FixResult,
  FixTextResult,
  FocusedTextAdapter,
  SelectionRange,
  SpellSuggestionEngine,
  TextSnapshot,
  TypoFixer,
} from "./core/types.js";
