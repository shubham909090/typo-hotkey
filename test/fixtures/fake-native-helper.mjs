#!/usr/bin/env node
import readline from "node:readline";

const input = readline.createInterface({ input: process.stdin });

input.on("line", (line) => {
  const request = JSON.parse(line);

  if (request.method === "accessibilityStatus") {
    respond(request.id, { trusted: true });
    return;
  }

  if (request.method === "suggestWords") {
    const result = Object.fromEntries(
      request.params.words.map((word) => [word, word === "waht" ? "what" : null]),
    );
    respond(request.id, result);
    return;
  }

  if (request.method === "readFocusedText") {
    respond(request.id, { text: "waht", selection: { location: 4, length: 0 }, secure: false });
    return;
  }

  if (request.method === "writeFocusedText") {
    respond(request.id, { written: true });
    return;
  }

  process.stdout.write(`${JSON.stringify({ id: request.id, ok: false, error: "unknown method" })}\n`);
});

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ id, ok: true, result })}\n`);
}
