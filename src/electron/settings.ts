import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface AppSettings {
  hotkey: string;
  language: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  hotkey: "Command+;",
  language: "en",
};
const LEGACY_DEFAULT_HOTKEYS = new Set([
  "CommandOrControl+Alt+K",
  "Alt+K",
  "Control+.",
  "Command+\\",
]);

export function loadSettings(userDataPath: string): AppSettings {
  const settingsPath = path.join(userDataPath, "settings.json");

  if (!existsSync(settingsPath)) {
    writeFileSync(settingsPath, `${JSON.stringify(DEFAULT_SETTINGS, null, 2)}\n`);
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8")) as Partial<AppSettings>;
    const settings = {
      hotkey:
        parsed.hotkey && !LEGACY_DEFAULT_HOTKEYS.has(parsed.hotkey)
          ? parsed.hotkey
          : DEFAULT_SETTINGS.hotkey,
      language: parsed.language || DEFAULT_SETTINGS.language,
    };

    if (settings.hotkey !== parsed.hotkey || settings.language !== parsed.language) {
      writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    }

    return settings;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
