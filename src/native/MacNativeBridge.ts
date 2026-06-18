import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import readline from "node:readline";
import type {
  FocusedTextAdapter,
  SelectionRange,
  SpellSuggestionEngine,
  TextSnapshot,
} from "../core/types.js";

interface RpcResponse<T> {
  id: number;
  ok: boolean;
  result?: T;
  error?: string;
}

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export interface MacNativeBridgeOptions {
  helperPath: string;
  helperArgs?: string[];
  language?: string;
  requestTimeoutMs?: number;
}

export class MacNativeBridge implements FocusedTextAdapter, SpellSuggestionEngine {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly language: string;
  private readonly pending = new Map<number, PendingRequest<unknown>>();
  private readonly timeoutMs: number;
  private nextId = 1;

  constructor(options: MacNativeBridgeOptions) {
    this.timeoutMs = options.requestTimeoutMs ?? 5_000;
    this.language = options.language ?? "en";
    this.child = spawn(options.helperPath, options.helperArgs ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const output = readline.createInterface({ input: this.child.stdout });
    output.on("line", (line) => this.handleLine(line));

    this.child.on("error", (error) => this.rejectAll(error));
    this.child.on("close", (code, signal) => {
      this.rejectAll(new Error(`Native helper exited with code ${code ?? "null"} signal ${signal ?? "null"}.`));
    });
  }

  async accessibilityStatus(prompt = false): Promise<{ trusted: boolean }> {
    return this.request("accessibilityStatus", { prompt });
  }

  async read(): Promise<TextSnapshot | null> {
    const snapshot = await this.request<TextSnapshot | null>("readFocusedText", {});
    if (!snapshot) {
      return null;
    }

    if (snapshot.secure) {
      return { text: "", secure: true };
    }

    if (typeof snapshot.text !== "string") {
      return { text: "", unsupported: true };
    }

    return snapshot;
  }

  async write(next: TextSnapshot): Promise<void> {
    await this.request("writeFocusedText", {
      text: next.text,
      selection: next.selection,
    });
  }

  async suggestMany(words: string[]): Promise<Record<string, string | null>> {
    const uniqueWords = [...new Set(words)];
    const result = await this.request<Record<string, string | null>>("suggestWords", {
      words: uniqueWords,
      language: this.language,
    });

    return Object.fromEntries(uniqueWords.map((word) => [word, result[word] ?? null]));
  }

  dispose(): void {
    this.child.kill();
  }

  private request<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Native helper timed out for ${method}.`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });

      try {
        this.child.stdin.write(`${payload}\n`);
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private handleLine(line: string): void {
    let response: RpcResponse<unknown>;
    try {
      response = JSON.parse(line) as RpcResponse<unknown>;
    } catch {
      return;
    }

    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(response.id);

    if (response.ok) {
      pending.resolve(response.result);
      return;
    }

    pending.reject(new Error(response.error ?? "Native helper request failed."));
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}

export type { SelectionRange };
