/**
 * LSP host integration test against the REAL typescript-language-server.
 *
 * This is the P5 proof: spawn the actual server through the P1 supervisor, do
 * the initialize handshake, open a real TS document, and get REAL completions —
 * the thing the user named missing ("keine autovervollständigung"). Skips
 * cleanly when the server is not on PATH (fast CI lane on a runner without it),
 * runs for real where it is installed (this machine + the nightly lane).
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LspHost, fileUri } from "../lsp/lsp-host.ts";

function which(cmd: string): string | undefined {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const p = join(dir, cmd);
    if (p && existsSync(p)) return p;
  }
  return undefined;
}

const server = which("typescript-language-server");
const run = server ? it : it.skip;

let dir: string;
let host: LspHost | undefined;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "capisco-lsp-"));
});
afterEach(() => {
  host?.dispose();
  host = undefined;
  rmSync(dir, { recursive: true, force: true });
});

describe("LspHost ↔ real typescript-language-server", () => {
  run(
    "returns real completions for a string member access",
    async () => {
      host = new LspHost({
        id: "lsp:ts:test",
        command: "typescript-language-server",
        args: ["--stdio"],
        rootPath: dir,
      });
      await host.ready();

      const file = join(dir, "sample.ts");
      const text = 'const greeting = "hello";\ngreeting.\n';
      const uri = fileUri(file);
      await host.openDoc(uri, "typescript", text);

      // Position: line 1 (0-based), right after "greeting." → string members.
      // Give the server a moment to project the program, then complete.
      let items = await host.completion(uri, 1, 9);
      for (let i = 0; i < 5 && items.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 300));
        items = await host.completion(uri, 1, 9);
      }
      const labels = items.map((i) => i.label);
      expect(items.length).toBeGreaterThan(0);
      // String.prototype members should be offered.
      expect(labels).toContain("toUpperCase");
    },
    30_000,
  );

  run(
    "returns hover type info for an identifier",
    async () => {
      host = new LspHost({
        id: "lsp:ts:test2",
        command: "typescript-language-server",
        args: ["--stdio"],
        rootPath: dir,
      });
      await host.ready();
      const file = join(dir, "h.ts");
      const uri = fileUri(file);
      await host.openDoc(uri, "typescript", "const answer = 42;\n");
      let hover: string | null = null;
      for (let i = 0; i < 5 && !hover; i++) {
        hover = await host.hover(uri, 0, 6); // on "answer"
        if (!hover) await new Promise((r) => setTimeout(r, 300));
      }
      expect(hover ?? "").toMatch(/answer|number/);
    },
    30_000,
  );
});
