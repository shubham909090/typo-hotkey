# Typo Hotkey

![Typo Hotkey icon](assets/icon.png)

Typo Hotkey is a tiny macOS menu bar app that fixes spelling mistakes in the text field you are currently typing in.

Press `Command + Option + K`, and it reads the focused editable field, fixes individual misspelled words, and writes the text back.

No AI. No grammar rewrite. No network. No tone cleanup. Just typo correction.

## Why I Built This

I built this because I kept running into the same annoying problem while writing prompts.

I would type fast, the spelling would be wrong in a bunch of places, and then I had to stop and manually clean up words like `waht`, `uou`, or `fuker`. That breaks flow. I did not want a big writing assistant rewriting my sentence, changing my tone, or making the prompt sound polished. I only wanted the dumb spelling mistakes fixed.

So this is a simple slop project: hit one hotkey, use native macOS spelling tools where possible, fix the current field, keep moving. Use it if it helps you.

## What It Does

- Runs in the macOS menu bar.
- Registers a global hotkey: `Command + Option + K`.
- Reads the currently focused text field.
- Fixes misspelled word tokens only.
- Preserves spacing, punctuation, casing, Markdown-ish inline code, URLs, emails, numbers, and code-like identifiers.
- Uses macOS `NSSpellChecker` first.
- Uses a local Hunspell fallback (`nspell` + `dictionary-en`) when native suggestions are missing or weak.
- Skips secure/password fields.

## What It Does Not Do

- It does not rewrite grammar.
- It does not improve tone.
- It does not send text to an AI service.
- It does not use the network for correction.
- It does not try to infer meaning for real-word mistakes.

That last bit matters. If you type a real word like `ill`, `nit`, or lowercase `i`, typo-only mode usually leaves it alone unless macOS itself returns a correction. Context-aware fixes are a different product mode.

## Install

Download the latest macOS build from the [Releases](https://github.com/shubham909090/typo-hotkey/releases) page.

Unzip it, move `Typo Hotkey.app` to `/Applications`, then open it.

This app is currently unsigned. If macOS blocks the first launch, right-click the app, choose Open, and confirm.

## Permissions

Typo Hotkey needs macOS Accessibility permission so it can read and replace text in the focused field.

Open:

```text
System Settings -> Privacy & Security -> Accessibility
```

Enable `Typo Hotkey`.

If macOS also shows `typo-hotkey-helper`, enable that too.

## Usage

1. Open any editable text field.
2. Type something with typos.
3. Press `Command + Option + K`.
4. The current field is replaced with the typo-fixed text.

Example:

```text
i hope you understand waht i mean
```

becomes:

```text
i hope you understand what i mean
```

## Settings

The settings file is created in Electron user data:

```json
{
  "hotkey": "CommandOrControl+Alt+K",
  "language": "en"
}
```

## Development

Requirements:

- macOS
- Node.js
- pnpm
- Xcode command line tools for Swift compilation

Install dependencies:

```bash
pnpm install
```

Run checks:

```bash
pnpm test
pnpm typecheck
pnpm build
```

Run locally:

```bash
pnpm dev
```

Build a macOS app and zip:

```bash
pnpm dist:mac
```

Outputs:

```text
release/mac-arm64/Typo Hotkey.app
release/Typo Hotkey-0.1.0-arm64-mac.zip
```

## Architecture

- Electron handles the menu bar app, global hotkey, settings, clipboard bridge, and notifications.
- TypeScript core owns tokenization, typo-fix behavior, casing, and protected-token rules.
- A Swift helper stays alive over newline JSON-RPC for fast macOS spell-check calls.
- macOS `NSSpellChecker` is the primary suggestion engine.
- Local Hunspell fallback handles cases where native suggestions are absent or clearly weaker.

## Privacy

Typo Hotkey processes text locally on your Mac. It does not call an API for correction.

The app does temporarily copy the current field through the system clipboard for broad app compatibility, then restores the previous clipboard content.

## License

MIT
