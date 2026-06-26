/**
 * LSP provider contract (road-to-actually-works P5). The editor reads real
 * language intelligence — completion, hover, diagnostics — over this surface;
 * the sidecar backs it with a per-(root × language) language server, and the
 * browser path serves a deterministic empty/mock fallback. Every value is
 * JSON-safe and non-secret.
 */

export interface LspCompletion {
  label: string;
  detail?: string;
  /** LSP CompletionItemKind (1=Text, 2=Method, …) — optional, for an icon. */
  kind?: number;
}

export interface LspProvider {
  /** True when a language server is installed for this LSP languageId. */
  available(languageId: string): Promise<boolean>;
  /** Open (sync) a document with the server before completion/hover. */
  open(root: string, uri: string, languageId: string, text: string): Promise<void>;
  /** Completions at a 0-based line/character. Empty when no server is installed. */
  completion(
    root: string,
    languageId: string,
    uri: string,
    line: number,
    character: number,
  ): Promise<LspCompletion[]>;
  /** Hover text at a 0-based line/character, or null. */
  hover(
    root: string,
    languageId: string,
    uri: string,
    line: number,
    character: number,
  ): Promise<string | null>;
}
