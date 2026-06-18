import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface AppSettings {
  hotkey: string;
  language: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  hotkey: "CommandOrControl+Alt+K",
  language: "en",
};

export function loadSettings(userDataPath: string): AppSettings {
  const settingsPath = path.join(userDataPath, "settings.json");

  if (!existsSync(settingsPath)) {
    writeFileSync(settingsPath, `${JSON.stringify(DEFAULT_SETTINGS, null, 2)}\n`);
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8")) as Partial<AppSettings>;
    return {
      hotkey: parsed.hotkey || DEFAULT_SETTINGS.hotkey,
      language: parsed.language || DEFAULT_SETTINGS.language,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
