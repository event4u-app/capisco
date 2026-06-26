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

/** 0-based line/character (LSP Position). */
export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

/** A resolved source location (go-to-definition / find-references target). */
export interface LspLocation {
  uri: string;
  range: LspRange;
}

/** One symbol in the document outline, flattened with a nesting `depth`. */
export interface LspSymbol {
  name: string;
  /** LSP SymbolKind (5=Class, 6=Method, 12=Function, …). */
  kind: number;
  range: LspRange;
  depth: number;
}

/** A single text edit a rename would apply within one file. */
export interface LspTextEdit {
  range: LspRange;
  newText: string;
}

/** A rename's edits, grouped per file — what the UI applies (gated) on accept. */
export interface LspWorkspaceEdit {
  changes: { uri: string; edits: LspTextEdit[] }[];
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
  /** Definition location(s) of the symbol at a position. Empty when none/no server. */
  definition(
    root: string,
    languageId: string,
    uri: string,
    line: number,
    character: number,
  ): Promise<LspLocation[]>;
  /** All references to the symbol at a position (declaration included). */
  references(
    root: string,
    languageId: string,
    uri: string,
    line: number,
    character: number,
  ): Promise<LspLocation[]>;
  /** The edits a rename of the symbol at a position would apply (UI gates the apply). */
  rename(
    root: string,
    languageId: string,
    uri: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<LspWorkspaceEdit>;
  /** The document outline (flattened symbols with depth). Empty when no server. */
  documentSymbol(root: string, languageId: string, uri: string): Promise<LspSymbol[]>;
}
