import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { MacNativeBridge } from "../src/native/MacNativeBridge.js";

const helperPath = process.env.TYPO_HOTKEY_HELPER ?? path.resolve("dist/native/typo-hotkey-helper");
const canRunNativeHelper = process.platform === "darwin" && existsSync(helperPath);

describe.runIf(canRunNativeHelper)("macOS native helper", () => {
  test("returns platform spell suggestions through JSON RPC", async () => {
    const bridge = new MacNativeBridge({ helperPath });

    try {
      const suggestions = await bridge.suggestMany(["waht"]);
      expect(suggestions).toHaveProperty("waht");
      if (suggestions.waht !== null) {
        expect(suggestions.waht.length).toBeGreaterThan(0);
      }
    } finally {
      bridge.dispose();
    }
  });
});
