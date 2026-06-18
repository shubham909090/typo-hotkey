import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";
import { MacNativeBridge } from "../src/native/MacNativeBridge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "fake-native-helper.mjs");

describe("MacNativeBridge JSON RPC", () => {
  let bridge: MacNativeBridge | null = null;

  afterEach(() => {
    bridge?.dispose();
    bridge = null;
  });

  test("round-trips accessibility status", async () => {
    bridge = new MacNativeBridge({
      helperPath: process.execPath,
      helperArgs: [fixturePath],
    });

    await expect(bridge.accessibilityStatus()).resolves.toEqual({ trusted: true });
  });

  test("maps suggestMany responses back to every requested word", async () => {
    bridge = new MacNativeBridge({
      helperPath: process.execPath,
      helperArgs: [fixturePath],
    });

    await expect(bridge.suggestMany(["waht", "known"])).resolves.toEqual({
      waht: "what",
      known: null,
    });
  });
});
