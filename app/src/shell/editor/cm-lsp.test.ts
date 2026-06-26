import { describe, expect, it } from "vitest";

import { lspFileUri, lspLanguageId, toCmCompletions } from "./cm-lsp";

describe("toCmCompletions", () => {
  it("maps LSP items to CM6 options anchored at `from`, with icon types", () => {
    const r = toCmCompletions(
      [
        { label: "toUpperCase", detail: "(method) String.toUpperCase(): string", kind: 2 },
        { label: "length", detail: "(property) String.length: number", kind: 10 },
        { label: "myVar", kind: 6 },
      ],
      7,
    );
    expect(r.from).toBe(7);
    expect(r.options).toEqual([
      {
        label: "toUpperCase",
        detail: "(method) String.toUpperCase(): string",
        type: "function",
      },
      { label: "length", detail: "(property) String.length: number", type: "property" },
      { label: "myVar", detail: undefined, type: "variable" },
    ]);
  });

  it("leaves an unknown kind untyped", () => {
    const r = toCmCompletions([{ label: "x", kind: 999 }], 0);
    expect(r.options[0].type).toBeUndefined();
  });
});

describe("lspLanguageId", () => {
  it.each([
    ["a.ts", "typescript"],
    ["a.tsx", "typescriptreact"],
    ["a.js", "javascript"],
    ["a.jsx", "javascriptreact"],
    ["a.mjs", "javascript"],
    ["a.php", "php"],
    ["a.phtml", "php"],
    ["README", "plaintext"],
    ["a.unknown", "plaintext"],
  ])("%s → %s", (file, expected) => {
    expect(lspLanguageId(file)).toBe(expected);
  });
});

describe("lspFileUri", () => {
  it("builds a file:// URI from an absolute path", () => {
    expect(lspFileUri("/Users/x/repo/src/app.ts")).toBe("file:///Users/x/repo/src/app.ts");
  });
  it("normalizes a path missing the leading slash", () => {
    expect(lspFileUri("repo/app.ts")).toBe("file:///repo/app.ts");
  });
});
