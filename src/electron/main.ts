import path from "node:path";
import { app, globalShortcut, Menu, nativeImage, Notification, shell, Tray } from "electron";
import { HybridSpellSuggestionEngine } from "../core/hybridSpellSuggestionEngine.js";
import { LocalSpellSuggestionEngine } from "../core/localSpellSuggestionEngine.js";
import { createTypoFixer } from "../core/typoFixer.js";
import { MacNativeBridge } from "../native/MacNativeBridge.js";
import { ClipboardFocusedTextAdapter } from "./ClipboardFocusedTextAdapter.js";
import { log } from "./log.js";
import { loadSettings } from "./settings.js";

let tray: Tray | null = null;
let nativeBridge: MacNativeBridge | null = null;

async function main(): Promise<void> {
  if (process.platform !== "darwin") {
    new Notification({
      title: "Typo Hotkey",
      body: "Typo Hotkey v1 supports macOS only.",
    }).show();
    app.quit();
    return;
  }

  const settings = loadSettings(app.getPath("userData"));
  const helperPath = resolveHelperPath();
  log("starting", { packaged: app.isPackaged, helperPath, hotkey: settings.hotkey });
  nativeBridge = new MacNativeBridge({ helperPath, language: settings.language });
  const spellSuggestions = new HybridSpellSuggestionEngine(nativeBridge, new LocalSpellSuggestionEngine());
  const focusedText = new ClipboardFocusedTextAdapter();
  const typoFixer = createTypoFixer({
    focusedText,
    spellSuggestions,
  });

  const runFix = async () => {
    log("fix requested");
    const result = await typoFixer.fixFocusedField();
    log("fix result", result);
    if (result.status === "fixed") {
      return;
    }

    if (result.status === "secure-field") {
      notify("Skipped secure field", "Typo Hotkey does not read password or secure fields.");
      return;
    }

    if (result.status === "error") {
      notify("Typo fix failed", result.reason ?? "Unknown error.");
    }
  };

  tray = createTray(settings.hotkey, runFix);

  const registered = globalShortcut.register(settings.hotkey, () => {
    log("hotkey pressed");
    void runFix();
  });
  log("hotkey registered", { registered });

  if (!registered) {
    notify("Hotkey unavailable", `${settings.hotkey} is already used by another app.`);
  }

  log("ready");
}

function createTray(hotkey: string, fixNow: () => Promise<void>): Tray {
  const trayIcon = nativeImage.createFromPath(resolveAssetPath("tray-icon-44.png"));
  trayIcon.setTemplateImage(false);
  const nextTray = new Tray(trayIcon.resize({ width: 22, height: 22 }));
  nextTray.setTitle("");
  nextTray.setToolTip(`Typo Hotkey (${formatHotkeyLabel(hotkey)})`);
  nextTray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Fix Current Field",
        click: () => {
          void fixNow();
        },
      },
      {
        label: "Open Accessibility Settings",
        click: () => {
          void shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit(),
      },
    ]),
  );
  return nextTray;
}

function formatHotkeyLabel(hotkey: string): string {
  return hotkey
    .replaceAll("CommandOrControl", "Command")
    .replaceAll("Alt", "Option")
    .replaceAll("+", " + ");
}

function resolveHelperPath(): string {
  if (process.env.TYPO_HOTKEY_HELPER) {
    return process.env.TYPO_HOTKEY_HELPER;
  }

  if (app.isPackaged) {
    return path.join(process.resourcesPath, "native", "typo-hotkey-helper");
  }

  return path.join(app.getAppPath(), "dist", "native", "typo-hotkey-helper");
}

function resolveAssetPath(fileName: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "assets", fileName);
  }

  return path.join(app.getAppPath(), "assets", fileName);
}

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) {
    return;
  }

  new Notification({ title, body }).show();
}

app.whenReady().then(() => {
  void main();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  nativeBridge?.dispose();
  nativeBridge = null;
  tray = null;
});
