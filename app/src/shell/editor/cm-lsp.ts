/**
 * CodeMirror 6 ↔ LSP autocomplete binding (road-to-actually-works P5, the visual
 * layer). Turns the real `lsp` provider's completions (proven against the real
 * typescript-language-server) into a CM6 completion source so the suggestion
 * list actually pops up in the editor.
 *
 * Guarded: the source no-ops unless a live sidecar is connected (`isDesktop()`)
 * AND a project root is open — so the browser/mock read-only path is untouched
 * and the pixel goldens stay byte-identical. The LSP→CM6 mapping + the
 * language-id / file-uri helpers are pure and unit-tested.
 */

import {
  autocompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import type { Extension } from "@codemirror/state";

import type { LspCompletion } from "@/contracts";
import { getProviders, isDesktop } from "@/lib/desktop-shell";

/** LSP CompletionItemKind → a CM6 completion `type` (drives the icon). */
function cmType(kind: number | undefined): string | undefined {
  switch (kind) {
    case 2:
    case 3:
      return "function"; // Method / Function
    case 5:
    case 10:
      return "property"; // Field / Property
    case 6:
      return "variable";
    case 7:
      return "class";
    case 8:
      return "interface";
    case 9:
      return "namespace"; // Module
    case 14:
      return "keyword";
    case 21:
      return "constant";
    case 22:
      return "type"; // Struct
    default:
      return undefined;
  }
}

/** Pure: map LSP completions to a CM6 completion result anchored at `from`. */
export function toCmCompletions(
  items: LspCompletion[],
  from: number,
): { from: number; options: Completion[] } {
  const options: Completion[] = items.map((i) => ({
    label: i.label,
    detail: i.detail,
    type: cmType(i.kind),
  }));
  return { from, options };
}

/** LSP languageId from a file path. Unknown → "plaintext" (server simply won't match). */
export function lspLanguageId(file: string): string {
  const dot = file.lastIndexOf(".");
  const ext = dot >= 0 ? file.slice(dot + 1).toLowerCase() : "";
  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescriptreact";
    case "js":
    case "mjs":
    case "cjs":
      return "javascript";
    case "jsx":
      return "javascriptreact";
    case "php":
    case "phtml":
      return "php";
    default:
      return "plaintext";
  }
}

/** A `file://` URI for an absolute path (browser-safe; no node:url). */
export function lspFileUri(absPath: string): string {
  const norm = absPath.startsWith("/") ? absPath : `/${absPath}`;
  return `file://${norm.split("\\").join("/")}`;
}

export interface LspEditorContext {
  /** The absolute file path of the open doc. */
  file: string;
  /** Resolve the project root lazily (null when no project is open). */
  root: () => string | undefined;
}

/** CM6 completion source backed by the live `lsp` provider. No-op off-desktop. */
export function lspCompletionSource(ctx: LspEditorContext): CompletionSource {
  const uri = lspFileUri(ctx.file);
  const languageId = lspLanguageId(ctx.file);
  return async (cc) => {
    if (!isDesktop()) return null;
    const root = ctx.root();
    if (!root) return null;
    const providers = getProviders();
    if (!providers.lsp) return null;
    const word = cc.matchBefore(/[\w$]*/);
    // Don't trigger on an empty token unless the user explicitly asked (Ctrl-Space).
    if (!word || (word.from === word.to && !cc.explicit)) return null;
    const lineObj = cc.state.doc.lineAt(cc.pos);
    const line = lineObj.number - 1; // LSP is 0-based
    const character = cc.pos - lineObj.from;
    try {
      const items = await providers.lsp.completion(root, languageId, uri, line, character);
      if (items.length === 0) return null;
      return toCmCompletions(items, word.from);
    } catch {
      return null;
    }
  };
}

/** Open the doc on the language server (so it indexes before completion). */
export function lspOpenDoc(ctx: LspEditorContext, text: string): void {
  if (!isDesktop()) return;
  const root = ctx.root();
  if (!root) return;
  const providers = getProviders();
  if (!providers.lsp) return;
  void providers.lsp
    .open(root, lspFileUri(ctx.file), lspLanguageId(ctx.file), text)
    .catch(() => {});
}

/** The autocompletion extension wired to the LSP source. */
export function lspAutocomplete(ctx: LspEditorContext): Extension {
  return autocompletion({ override: [lspCompletionSource(ctx)] });
}
