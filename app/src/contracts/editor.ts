/**
 * Editor PROVIDER-OUTPUT contracts (build-spec §7). Council-P1: autocomplete,
 * inlay hints, blame and presence are LSP/git/presence *outputs* — mock
 * providers behind these interfaces, never CodeMirror features.
 */

export interface CompletionItem {
  label: string;
  /** Symbol kind hint for the leading icon (method/variable/…). */
  kind: string;
  detail?: string;
}

export interface InlayHint {
  line: number;
  /** Column before the argument the hint annotates. */
  col: number;
  /** Rendered text, e.g. "principal:". */
  label: string;
}

export interface BlameLine {
  line: number;
  author: string;
  date: string;
  commit: string;
  summary?: string;
}

export interface PresenceMarker {
  who: string;
  /** Two-letter avatar initials. */
  init: string;
  branch: string;
  pr?: string;
  when: string;
  /** Inclusive line range the colleague has touched. */
  fromLine: number;
  toLine: number;
  /** Inline diff of their change, shown in the live-presence popup. */
  diff: { sign: "+" | "−"; line: number; text: string }[];
}

/** Per-line git change bar in the gutter (Modified / Added / Deleted). */
export interface ChangeBar {
  line: number;
  kind: "M" | "A" | "D";
}

/** A foldable region (LSP-style range output), 1-based inclusive lines. */
export interface FoldRange {
  fromLine: number;
  toLine: number;
}

/**
 * The document a CM6 tab renders. `text` is the raw source CM6 indexes; the
 * provider outputs (completions/hints/blame/presence/folds/changeBars) are
 * mock-provider data laid over it, never CodeMirror-derived.
 */
export interface EditorDoc {
  /** File path / tab id. */
  file: string;
  /** File extension for the leading icon + language mode. */
  ext: string;
  /** Raw source — the only thing CodeMirror itself indexes. */
  text: string;
  pinned?: boolean;
  dirty?: boolean;
}

export interface EditorProvider {
  getDocs(): EditorDoc[];
  getDoc(file: string): EditorDoc | undefined;
  getCompletions(file: string, line: number): CompletionItem[];
  getInlayHints(file: string): InlayHint[];
  getBlame(file: string): BlameLine[];
  getPresence(file: string): PresenceMarker[];
  getFolds(file: string): FoldRange[];
  getChangeBars(file: string): ChangeBar[];
  /** 1-based line the editor caret/active line sits on (blame anchor). */
  getActiveLine(file: string): number;
}
