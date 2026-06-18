# Typo Hotkey Context

## Domain Language

- Typo Hotkey: macOS tray tool that corrects misspelled words in current focused text field when user presses global hotkey.
- Focused Text Field: editable macOS accessibility element that currently owns keyboard focus.
- Typo Fix: word-level spelling correction only. It never rewrites grammar, sentence structure, tone, or meaning.
- Native Helper: long-lived Swift process that owns macOS Accessibility and NSSpellChecker calls.
- Spell Suggestion: platform-default top suggestion for one misspelled word.
- Protected Token: text that must not be corrected, such as URLs, email addresses, inline code, code-like identifiers, paths, and numbers.
