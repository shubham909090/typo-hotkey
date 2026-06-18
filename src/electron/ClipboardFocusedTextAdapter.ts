import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { clipboard } from "electron";
import type { FocusedTextAdapter, TextSnapshot } from "../core/types.js";

const execFileAsync = promisify(execFile);

export class ClipboardFocusedTextAdapter implements FocusedTextAdapter {
  private clipboardBeforeFix: string | null = null;

  async read(): Promise<TextSnapshot | null> {
    const sentinel = `__TYPO_HOTKEY_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
    this.clipboardBeforeFix = clipboard.readText();
    clipboard.writeText(sentinel);

    await keystroke("a", "command down");
    await keystroke("c", "command down");
    await delay(120);

    const copied = clipboard.readText();
    if (copied === sentinel) {
      clipboard.writeText(this.clipboardBeforeFix);
      this.clipboardBeforeFix = null;
      return null;
    }

    return { text: copied };
  }

  async write(next: TextSnapshot): Promise<void> {
    const originalClipboard = this.clipboardBeforeFix;
    clipboard.writeText(next.text);
    await keystroke("v", "command down");
    await delay(160);

    if (originalClipboard !== null) {
      clipboard.writeText(originalClipboard);
      this.clipboardBeforeFix = null;
    }
  }
}

async function keystroke(key: string, modifier: string): Promise<void> {
  await execFileAsync("osascript", [
    "-e",
    `tell application "System Events" to keystroke "${key}" using ${modifier}`,
  ]);
}
