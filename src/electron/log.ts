import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { app } from "electron";

export function log(message: string, details?: unknown): void {
  try {
    const logsDir = path.join(app.getPath("userData"), "logs");
    mkdirSync(logsDir, { recursive: true });
    const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
    appendFileSync(path.join(logsDir, "main.log"), `${new Date().toISOString()} ${message}${suffix}\n`);
  } catch {
    // Logging must never break global hotkey handling.
  }
}
