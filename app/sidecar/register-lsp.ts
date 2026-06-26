/**
 * Register the `lsp` provider (road-to-actually-works P5) — real language
 * intelligence over the IPC wire, backed by {@link LspManager}. Lazy: a server
 * spawns only on first use for a (root × language); degrades to empty when the
 * server is not installed (the doctor reports which are missing).
 */

import type { ProviderRegistry } from "./registry/registry.ts";
import { LspManager } from "./lsp/lsp-manager.ts";

export const LSP_PROVIDER_ID = "lsp";

export function registerLsp(registry: ProviderRegistry): LspManager {
  const manager = new LspManager();
  registry.register(LSP_PROVIDER_ID, {
    available: (languageId: string) => Promise.resolve(manager.available(languageId)),
    open: (root: string, uri: string, languageId: string, text: string) =>
      manager.open(root, uri, languageId, text),
    completion: (root: string, languageId: string, uri: string, line: number, character: number) =>
      manager.completion(root, languageId, uri, line, character),
    hover: (root: string, languageId: string, uri: string, line: number, character: number) =>
      manager.hover(root, languageId, uri, line, character),
    definition: (root: string, languageId: string, uri: string, line: number, character: number) =>
      manager.definition(root, languageId, uri, line, character),
    references: (root: string, languageId: string, uri: string, line: number, character: number) =>
      manager.references(root, languageId, uri, line, character),
    rename: (root: string, languageId: string, uri: string, line: number, character: number, newName: string) =>
      manager.rename(root, languageId, uri, line, character, newName),
    documentSymbol: (root: string, languageId: string, uri: string) =>
      manager.documentSymbol(root, languageId, uri),
  } as never);
  return manager;
}
