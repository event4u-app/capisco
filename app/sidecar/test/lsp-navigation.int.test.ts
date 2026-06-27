/**
 * Advanced-LSP navigation (road-to-real-runtime P3).
 *  - PURE: the polymorphic-response normalizers (no server).
 *  - INTEGRATION: definition / references / rename / documentSymbol against the
 *    REAL typescript-language-server (skips cleanly when not on PATH).
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LspHost, fileUri } from "../lsp/lsp-host.ts";
import {
  normalizeFoldingRanges,
  normalizeInlayHints,
  normalizeLocations,
  normalizeSymbols,
  normalizeWorkspaceEdit,
} from "../lsp/lsp-normalize.ts";

const R = { start: { line: 1, character: 2 }, end: { line: 1, character: 9 } };

describe("normalizeLocations", () => {
  it("folds a single Location, a Location[], and LocationLink[] into LspLocation[]", () => {
    expect(normalizeLocations(null)).toEqual([]);
    expect(normalizeLocations({ uri: "file:///a.ts", range: R })).toEqual([{ uri: "file:///a.ts", range: R }]);
    expect(normalizeLocations([{ uri: "file:///b.ts", range: R }])).toEqual([{ uri: "file:///b.ts", range: R }]);
    expect(
      normalizeLocations([{ targetUri: "file:///c.ts", targetRange: R, targetSelectionRange: R }]),
    ).toEqual([{ uri: "file:///c.ts", range: R }]);
  });
});

describe("normalizeWorkspaceEdit", () => {
  it("handles both `changes` and `documentChanges` forms", () => {
    expect(normalizeWorkspaceEdit({ changes: { "file:///a.ts": [{ range: R, newText: "x" }] } })).toEqual({
      changes: [{ uri: "file:///a.ts", edits: [{ range: R, newText: "x" }] }],
    });
    expect(
      normalizeWorkspaceEdit({
        documentChanges: [{ textDocument: { uri: "file:///b.ts" }, edits: [{ range: R, newText: "y" }] }],
      }),
    ).toEqual({ changes: [{ uri: "file:///b.ts", edits: [{ range: R, newText: "y" }] }] });
    expect(normalizeWorkspaceEdit(null)).toEqual({ changes: [] });
  });
});

describe("normalizeSymbols", () => {
  it("flattens hierarchical DocumentSymbol[] with depth", () => {
    const syms = normalizeSymbols([
      { name: "Foo", kind: 5, range: R, children: [{ name: "bar", kind: 6, range: R }] },
    ]);
    expect(syms).toEqual([
      { name: "Foo", kind: 5, range: R, depth: 0 },
      { name: "bar", kind: 6, range: R, depth: 1 },
    ]);
  });
  it("maps flat SymbolInformation[] (range from location)", () => {
    expect(normalizeSymbols([{ name: "g", kind: 13, location: { uri: "file:///a", range: R } }])).toEqual([
      { name: "g", kind: 13, range: R, depth: 0 },
    ]);
  });
});

describe("normalizeFoldingRanges", () => {
  it("keeps line-based folds with their kind, drops malformed entries", () => {
    expect(normalizeFoldingRanges(null)).toEqual([]);
    expect(
      normalizeFoldingRanges([
        { startLine: 0, endLine: 4, kind: "imports" },
        { startLine: 6, endLine: 9 },
        { startLine: 2 }, // no endLine → dropped
      ]),
    ).toEqual([
      { startLine: 0, endLine: 4, kind: "imports" },
      { startLine: 6, endLine: 9 },
    ]);
  });
});

describe("normalizeInlayHints", () => {
  it("handles string labels and InlayHintLabelPart[] labels", () => {
    expect(normalizeInlayHints([{ position: { line: 2, character: 5 }, label: ": string", kind: 1 }])).toEqual([
      { position: { line: 2, character: 5 }, label: ": string", kind: 1 },
    ]);
    expect(
      normalizeInlayHints([{ position: { line: 0, character: 0 }, label: [{ value: "name" }, { value: ":" }] }]),
    ).toEqual([{ position: { line: 0, character: 0 }, label: "name:" }]);
    expect(normalizeInlayHints(null)).toEqual([]);
  });
});

function which(cmd: string): string | undefined {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const p = join(dir, cmd);
    if (p && existsSync(p)) return p;
  }
  return undefined;
}

const server = which("typescript-language-server");
const run = server ? it : it.skip;

describe("LspHost navigation ↔ real typescript-language-server", () => {
  let dir: string;
  let host: LspHost | undefined;
  const text = ["const greeting = \"hello\";", "const shout = greeting.toUpperCase();", "const echo = greeting;", ""].join("\n");

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "capisco-lspnav-"));
  });
  afterEach(() => {
    host?.dispose();
    host = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  async function open(): Promise<string> {
    host = new LspHost({ id: "lsp:ts:nav", command: "typescript-language-server", args: ["--stdio"], rootPath: dir });
    await host.ready();
    const uri = fileUri(join(dir, "sample.ts"));
    await host.openDoc(uri, "typescript", text);
    return uri;
  }
  async function retry<T>(fn: () => Promise<T[]>): Promise<T[]> {
    let out = await fn();
    for (let i = 0; i < 6 && out.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 300));
      out = await fn();
    }
    return out;
  }

  run("definition of a usage resolves to the declaration line", async () => {
    const uri = await open();
    // `greeting` inside `shout = greeting...` on line 1.
    const locs = await retry(() => host!.definition(uri, 1, 16));
    expect(locs.length).toBeGreaterThan(0);
    expect(locs[0].range.start.line).toBe(0); // declared on line 0
  }, 30_000);

  run("references of the declaration finds all usages (declaration included)", async () => {
    const uri = await open();
    // `greeting` declaration on line 0 (char 6..14).
    const refs = await retry(() => host!.references(uri, 0, 8));
    expect(refs.length).toBeGreaterThanOrEqual(2);
  }, 30_000);

  run("rename produces a workspace edit with text edits", async () => {
    const uri = await open();
    let we = await host!.rename(uri, 0, 8, "salutation");
    for (let i = 0; i < 6 && we.changes.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 300));
      we = await host!.rename(uri, 0, 8, "salutation");
    }
    expect(we.changes.length).toBeGreaterThan(0);
    expect(we.changes[0].edits.length).toBeGreaterThan(0);
    expect(we.changes[0].edits[0].newText).toBe("salutation");
  }, 30_000);

  run("documentSymbol lists the top-level symbols", async () => {
    const uri = await open();
    const syms = await retry(() => host!.documentSymbol(uri));
    expect(syms.length).toBeGreaterThan(0);
    expect(syms.map((s) => s.name)).toContain("greeting");
  }, 30_000);

  run("foldingRanges returns a fold for a multi-line block", async () => {
    const fnText = [
      "function compute(a: number, b: number): number {",
      "  const sum = a + b;",
      "  const doubled = sum * 2;",
      "  return doubled;",
      "}",
      "",
    ].join("\n");
    host = new LspHost({ id: "lsp:ts:fold", command: "typescript-language-server", args: ["--stdio"], rootPath: dir });
    await host.ready();
    const uri = fileUri(join(dir, "fold.ts"));
    await host.openDoc(uri, "typescript", fnText);
    const folds = await retry(() => host!.foldingRanges(uri));
    expect(folds.length).toBeGreaterThan(0);
    // The function body spans from its first line to a later line.
    expect(folds.some((f) => f.startLine === 0 && f.endLine >= 3)).toBe(true);
  }, 30_000);

  run("inlayHints returns variable-type hints when the server is configured for them", async () => {
    // tsserver only emits inlay hints with the preferences set at initialize.
    host = new LspHost({
      id: "lsp:ts:inlay",
      command: "typescript-language-server",
      args: ["--stdio"],
      rootPath: dir,
      initializationOptions: {
        preferences: { includeInlayVariableTypeHints: true, includeInlayParameterNameHints: "all" },
      },
    });
    await host.ready();
    const uri = fileUri(join(dir, "sample.ts"));
    await host.openDoc(uri, "typescript", text);
    const hints = await retry(() => host!.inlayHints(uri, 0, 4));
    expect(hints.length).toBeGreaterThan(0);
    expect(typeof hints[0].label).toBe("string");
  }, 30_000);
});
