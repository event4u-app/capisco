/**
 * Pure normalizers for the polymorphic LSP navigation responses
 * (road-to-real-runtime P3). A language server may answer the same request in
 * several shapes — definition as `Location | Location[] | LocationLink[]`,
 * rename as `WorkspaceEdit.changes | .documentChanges`, symbols as
 * `DocumentSymbol[]` (hierarchical) | `SymbolInformation[]` (flat). These fold
 * each into the single contract shape. Pure → unit-tested without a server.
 */

import type {
  LspInlayHint,
  LspLocation,
  LspPosition,
  LspRange,
  LspSymbol,
  LspTextEdit,
  LspWorkspaceEdit,
} from "@/contracts";

const ZERO: LspRange = { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };

function asRange(r: unknown): LspRange {
  const range = r as Partial<LspRange> | undefined;
  if (!range?.start || !range.end) return ZERO;
  return {
    start: { line: range.start.line ?? 0, character: range.start.character ?? 0 },
    end: { line: range.end.line ?? 0, character: range.end.character ?? 0 },
  };
}

/** textDocument/definition (or /references): Location | Location[] | LocationLink[] → LspLocation[]. */
export function normalizeLocations(raw: unknown): LspLocation[] {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: LspLocation[] = [];
  for (const item of arr) {
    const o = item as Record<string, unknown>;
    // LocationLink — { targetUri, targetRange, targetSelectionRange }
    if (typeof o.targetUri === "string") {
      out.push({ uri: o.targetUri, range: asRange(o.targetSelectionRange ?? o.targetRange) });
      continue;
    }
    // Location — { uri, range }
    if (typeof o.uri === "string") {
      out.push({ uri: o.uri, range: asRange(o.range) });
    }
  }
  return out;
}

/** textDocument/rename WorkspaceEdit (changes | documentChanges) → LspWorkspaceEdit. */
export function normalizeWorkspaceEdit(raw: unknown): LspWorkspaceEdit {
  const we = raw as Record<string, unknown> | null;
  const changes: LspWorkspaceEdit["changes"] = [];
  const editsOf = (list: unknown): LspTextEdit[] =>
    (Array.isArray(list) ? list : []).map((e) => {
      const edit = e as Record<string, unknown>;
      return { range: asRange(edit.range), newText: `${edit.newText ?? ""}` };
    });

  // Form A: changes: { [uri]: TextEdit[] }
  const byUri = we?.changes as Record<string, unknown> | undefined;
  if (byUri && typeof byUri === "object") {
    for (const [uri, edits] of Object.entries(byUri)) changes.push({ uri, edits: editsOf(edits) });
  }
  // Form B: documentChanges: [{ textDocument: { uri }, edits: TextEdit[] }]
  const docChanges = we?.documentChanges;
  if (Array.isArray(docChanges)) {
    for (const dc of docChanges) {
      const d = dc as { textDocument?: { uri?: string }; edits?: unknown };
      const uri = d.textDocument?.uri;
      if (typeof uri === "string") changes.push({ uri, edits: editsOf(d.edits) });
    }
  }
  return { changes };
}

/** textDocument/inlayHint: InlayHint[] → LspInlayHint[] (label may be string | InlayHintLabelPart[]). */
export function normalizeInlayHints(raw: unknown): LspInlayHint[] {
  if (!Array.isArray(raw)) return [];
  const out: LspInlayHint[] = [];
  for (const h of raw) {
    const o = h as Record<string, unknown>;
    const pos = o.position as Partial<LspPosition> | undefined;
    if (!pos) continue;
    const rawLabel = o.label;
    const label =
      typeof rawLabel === "string"
        ? rawLabel
        : Array.isArray(rawLabel)
          ? rawLabel.map((p) => `${(p as { value?: string }).value ?? ""}`).join("")
          : "";
    const hint: LspInlayHint = {
      position: { line: pos.line ?? 0, character: pos.character ?? 0 },
      label,
    };
    if (typeof o.kind === "number") hint.kind = o.kind;
    out.push(hint);
  }
  return out;
}

/** textDocument/documentSymbol: DocumentSymbol[] | SymbolInformation[] → flat LspSymbol[] with depth. */
export function normalizeSymbols(raw: unknown): LspSymbol[] {
  if (!Array.isArray(raw)) return [];
  const out: LspSymbol[] = [];
  const walk = (nodes: unknown[], depth: number): void => {
    for (const n of nodes) {
      const o = n as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name : "";
      const kind = typeof o.kind === "number" ? o.kind : 0;
      // SymbolInformation — { name, kind, location: { range } }
      const loc = o.location as { range?: unknown } | undefined;
      const range = loc?.range !== undefined ? asRange(loc.range) : asRange(o.range);
      if (name) out.push({ name, kind, range, depth });
      // DocumentSymbol — { ..., children: DocumentSymbol[] }
      if (Array.isArray(o.children)) walk(o.children, depth + 1);
    }
  };
  walk(raw, 0);
  return out;
}
