import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { loadSettings } from "../src/electron/settings.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function makeUserDataDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "typo-hotkey-settings-"));
  tempDirs.push(directory);
  return directory;
}

describe("loadSettings", () => {
  test("creates default settings with the two-key hotkey", () => {
    const userData = makeUserDataDir();

    const settings = loadSettings(userData);

    expect(settings).toEqual({ hotkey: "Command+\\", language: "en" });
    expect(JSON.parse(readFileSync(path.join(userData, "settings.json"), "utf8"))).toEqual(
      settings,
    );
  });

  test("migrates the old default hotkey to the new two-key hotkey", () => {
    const userData = makeUserDataDir();
    writeFileSync(
      path.join(userData, "settings.json"),
      `${JSON.stringify({ hotkey: "CommandOrControl+Alt+K", language: "en" })}\n`,
    );

    const settings = loadSettings(userData);

    expect(settings).toEqual({ hotkey: "Command+\\", language: "en" });
    expect(JSON.parse(readFileSync(path.join(userData, "settings.json"), "utf8"))).toEqual(
      settings,
    );
  });

  test("migrates the option-key default hotkey to the command-backslash hotkey", () => {
    const userData = makeUserDataDir();
    writeFileSync(
      path.join(userData, "settings.json"),
      `${JSON.stringify({ hotkey: "Alt+K", language: "en" })}\n`,
    );

    const settings = loadSettings(userData);

    expect(settings).toEqual({ hotkey: "Command+\\", language: "en" });
    expect(JSON.parse(readFileSync(path.join(userData, "settings.json"), "utf8"))).toEqual(
      settings,
    );
  });

  test("migrates the control-period default hotkey to the command-backslash hotkey", () => {
    const userData = makeUserDataDir();
    writeFileSync(
      path.join(userData, "settings.json"),
      `${JSON.stringify({ hotkey: "Control+.", language: "en" })}\n`,
    );

    const settings = loadSettings(userData);

    expect(settings).toEqual({ hotkey: "Command+\\", language: "en" });
    expect(JSON.parse(readFileSync(path.join(userData, "settings.json"), "utf8"))).toEqual(
      settings,
    );
  });

  test("keeps a custom hotkey", () => {
    const userData = makeUserDataDir();
    writeFileSync(
      path.join(userData, "settings.json"),
      `${JSON.stringify({ hotkey: "Shift+Alt+K", language: "en" })}\n`,
    );

    expect(loadSettings(userData)).toEqual({ hotkey: "Shift+Alt+K", language: "en" });
  });
});
