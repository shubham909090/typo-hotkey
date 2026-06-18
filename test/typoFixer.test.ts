import { describe, expect, test } from "vitest";
import { HybridSpellSuggestionEngine } from "../src/core/hybridSpellSuggestionEngine.js";
import { LocalSpellSuggestionEngine } from "../src/core/localSpellSuggestionEngine.js";
import { createTypoFixer } from "../src/core/typoFixer.js";
import type { FocusedTextAdapter, SpellSuggestionEngine, TextSnapshot } from "../src/core/types.js";

class FakeSpellSuggestions implements SpellSuggestionEngine {
  checkedWords: string[][] = [];

  constructor(private readonly suggestions: Record<string, string | null>) {}

  async suggestMany(words: string[]): Promise<Record<string, string | null>> {
    this.checkedWords.push(words);
    return Object.fromEntries(words.map((word) => [word, this.suggestions[word] ?? null]));
  }
}

class FakeFocusedText implements FocusedTextAdapter {
  written: TextSnapshot | null = null;

  constructor(private readonly snapshot: TextSnapshot | null) {}

  async read(): Promise<TextSnapshot | null> {
    return this.snapshot;
  }

  async write(next: TextSnapshot): Promise<void> {
    this.written = next;
  }
}

describe("TypoFixer text behavior", () => {
  test("fixes one misspelled word without changing surrounding text", async () => {
    const fixer = createTypoFixer({
      focusedText: new FakeFocusedText(null),
      spellSuggestions: new FakeSpellSuggestions({ waht: "what" }),
    });

    await expect(fixer.fixText("i hope you understand waht i mean")).resolves.toMatchObject({
      text: "i hope you understand what i mean",
      changed: true,
      suggestionsChecked: 5,
    });
  });

  test("preserves case and punctuation for replacements", async () => {
    const fixer = createTypoFixer({
      focusedText: new FakeFocusedText(null),
      spellSuggestions: new FakeSpellSuggestions({ waht: "what" }),
    });

    const result = await fixer.fixText("WAHT, Waht, waht.");

    expect(result.text).toBe("WHAT, What, what.");
    expect(result.changedWords).toEqual([
      { original: "WAHT", replacement: "WHAT", start: 0, end: 4 },
      { original: "Waht", replacement: "What", start: 6, end: 10 },
      { original: "waht", replacement: "what", start: 12, end: 16 },
    ]);
  });

  test("leaves protected tokens untouched", async () => {
    const fixer = createTypoFixer({
      focusedText: new FakeFocusedText(null),
      spellSuggestions: new FakeSpellSuggestions({
        waht: "what",
        example: "sample",
        com: "come",
        user: "use",
        obj: "object",
        load: "loaded",
        foo: "food",
        bar: "bear",
      }),
    });

    const result = await fixer.fixText(
      "waht https://example.com user@example.com `waht` obj.waht loadData() foo_bar 123abc",
    );

    expect(result.text).toBe(
      "what https://example.com user@example.com `waht` obj.waht loadData() foo_bar 123abc",
    );
  });

  test("keeps words unchanged when suggestion engine has no suggestion", async () => {
    const fixer = createTypoFixer({
      focusedText: new FakeFocusedText(null),
      spellSuggestions: new FakeSpellSuggestions({ qqqzzz: null }),
    });

    await expect(fixer.fixText("qqqzzz")).resolves.toMatchObject({
      text: "qqqzzz",
      changed: false,
      changedWords: [],
    });
  });

  test("dedupes repeated words before asking for suggestions", async () => {
    const suggestions = new FakeSpellSuggestions({ waht: "what" });
    const fixer = createTypoFixer({
      focusedText: new FakeFocusedText(null),
      spellSuggestions: suggestions,
    });

    const result = await fixer.fixText("waht waht waht");

    expect(result.text).toBe("what what what");
    expect(suggestions.checkedWords).toEqual([["waht"]]);
    expect(result.suggestionsChecked).toBe(1);
  });

  test("fixes rough typed prompt text with native plus local fallback", async () => {
    const primary = new FakeSpellSuggestions({
      asdsa: "adds",
      dasd: "dad",
      ufiltered: "filtered",
      im: "I'm",
    });
    const fixer = createTypoFixer({
      focusedText: new FakeFocusedText(null),
      spellSuggestions: new HybridSpellSuggestionEngine(primary, new LocalSpellSuggestionEngine()),
    });

    const result = await fixer.fixText(
      "asdsa== dasd. hello i don;t understand this shit but it's ufiltered and im nit sure\n",
    );

    expect(result.text).toBe(
      "adds== dad. hello i don't understand this shit but it's unfiltered and I'm nit sure\n",
    );
  });

  test("uses generated dictionary candidates without sample-specific overrides", async () => {
    const fixer = createTypoFixer({
      focusedText: new FakeFocusedText(null),
      spellSuggestions: new HybridSpellSuggestionEngine(new FakeSpellSuggestions({}), new LocalSpellSuggestionEngine()),
    });

    const result = await fixer.fixText("waht athat tyet fuk fuker uou");

    expect(result.text).toBe("what that yet fuck fucker you");
  });

  test("lets local scoring veto weak native guesses", async () => {
    const fixer = createTypoFixer({
      focusedText: new FakeFocusedText(null),
      spellSuggestions: new HybridSpellSuggestionEngine(
        new FakeSpellSuggestions({ fuk: "fun", fuker: "faker" }),
        new LocalSpellSuggestionEngine(),
      ),
    });

    const result = await fixer.fixText("fuk fuker");

    expect(result.text).toBe("fuck fucker");
  });

  test("leaves dictionary-valid words and lowercase i alone without context rewriting", async () => {
    const fixer = createTypoFixer({
      focusedText: new FakeFocusedText(null),
      spellSuggestions: new HybridSpellSuggestionEngine(new FakeSpellSuggestions({}), new LocalSpellSuggestionEngine()),
    });

    const result = await fixer.fixText("ill nit i");

    expect(result.text).toBe("ill nit i");
    expect(result.changed).toBe(false);
  });
});

describe("TypoFixer focused-field behavior", () => {
  test("writes fixed text back to focused field", async () => {
    const focusedText = new FakeFocusedText({
      text: "waht now",
      selection: { location: 8, length: 0 },
    });
    const fixer = createTypoFixer({
      focusedText,
      spellSuggestions: new FakeSpellSuggestions({ waht: "what" }),
    });

    await expect(fixer.fixFocusedField()).resolves.toMatchObject({
      status: "fixed",
      afterText: "what now",
    });
    expect(focusedText.written).toEqual({
      text: "what now",
      selection: { location: 8, length: 0 },
    });
  });

  test("returns safe no-op for secure fields", async () => {
    const focusedText = new FakeFocusedText({ text: "", secure: true });
    const fixer = createTypoFixer({
      focusedText,
      spellSuggestions: new FakeSpellSuggestions({}),
    });

    await expect(fixer.fixFocusedField()).resolves.toMatchObject({
      status: "secure-field",
      changedWords: [],
    });
    expect(focusedText.written).toBeNull();
  });

  test("returns safe no-op when focused field is unsupported", async () => {
    const focusedText = new FakeFocusedText({ text: "", unsupported: true });
    const fixer = createTypoFixer({
      focusedText,
      spellSuggestions: new FakeSpellSuggestions({}),
    });

    await expect(fixer.fixFocusedField()).resolves.toMatchObject({
      status: "unsupported",
      changedWords: [],
    });
    expect(focusedText.written).toBeNull();
  });
});
