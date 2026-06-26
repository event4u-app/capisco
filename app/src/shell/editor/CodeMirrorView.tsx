import * as React from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers, gutter, GutterMarker } from "@codemirror/view";
import { foldGutter, codeFolding, foldKeymap, foldService } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { php } from "@codemirror/lang-php";

import type { ChangeBar, EditorDoc, FoldRange } from "@/contracts";
import { editorSnapshot } from "@/mocks";
import { capiscoTheme, capiscoSyntax } from "./cm-theme";
import {
  rainbowBrackets,
  rainbowBracketTheme,
  indentGuides,
  indentGuideTheme,
} from "./cm-extensions";
import { lspAutocomplete, lspOpenDoc, type LspEditorContext } from "./cm-lsp";
import { useOpenProject } from "@/shell/open-project-store";

/** Git change-bar gutter marker (Modified amber / Added green / Deleted red). */
/**
 * Pick the CodeMirror language by file extension (road-to-actually-works P4).
 * The grammar drives syntax highlighting AND syntactic folding (the language's
 * fold ranges feed `codeFolding()`). LSP-accurate folding/diagnostics arrive in
 * P5; this is the grammar layer. Unknown extensions fall back to JS/TS so a file
 * is never unstyled.
 */
function languageForFile(file: string): Extension {
  const dot = file.lastIndexOf(".");
  const ext = dot >= 0 ? file.slice(dot + 1).toLowerCase() : "";
  if (ext === "php" || ext === "phtml") return php();
  return javascript({
    typescript: ext !== "js" && ext !== "jsx" && ext !== "mjs" && ext !== "cjs",
  });
}

class ChangeBarMarker extends GutterMarker {
  readonly kind: ChangeBar["kind"];
  constructor(kind: ChangeBar["kind"]) {
    super();
    this.kind = kind;
  }
  eq(o: ChangeBarMarker) {
    return o.kind === this.kind;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = `cm-change-bar cm-change-${this.kind}`;
    el.setAttribute("aria-hidden", "true");
    return el;
  }
}

/**
 * Provider-driven fold service (Council-P1): the foldable regions come from the
 * MOCK EditorProvider's FoldRange[], NOT from CodeMirror's syntax tree. The
 * fold gutter shows a chevron on each range's first line; the fold collapses
 * from the end of the first line to the end of the last.
 */
function providerFolds(folds: FoldRange[]) {
  return foldService.of((state, lineStart, lineEnd) => {
    const lineNo = state.doc.lineAt(lineStart).number;
    const range = folds.find((f) => f.fromLine === lineNo);
    if (!range || range.toLine > state.doc.lines) return null;
    return { from: lineEnd, to: state.doc.line(range.toLine).to };
  });
}

function changeBarGutter(bars: ChangeBar[]) {
  const byLine = new Map(bars.map((b) => [b.line, b.kind]));
  return [
    gutter({
      class: "cm-change-gutter",
      lineMarker(view, line) {
        const lineNo = view.state.doc.lineAt(line.from).number;
        const kind = byLine.get(lineNo);
        return kind ? new ChangeBarMarker(kind) : null;
      },
      initialSpacer: () => new ChangeBarMarker("M"),
    }),
    EditorView.baseTheme({
      ".cm-change-gutter": { width: "3px", padding: "0" },
      ".cm-change-gutter .cm-gutterElement": { padding: "0" },
      ".cm-change-bar": { width: "3px", height: "100%" },
      ".cm-change-M": { background: "var(--git-modified)" },
      ".cm-change-A": { background: "var(--git-added)" },
      ".cm-change-D": { background: "var(--git-deleted)" },
    }),
  ];
}

/**
 * CodeMirror 6 mount (roadmap Phase 0 read-only · Phase 2 editable). Renders the
 * EditorDoc with the JetBrains-dark theme, muted syntax highlighting, rainbow
 * brackets, indent guides, code folding (ranges from the mock provider) and a
 * git change-bar gutter.
 *
 * Editing (P2): when `onChange` is given (a REAL opened-from-disk doc), the view
 * is editable — keystrokes push the buffer up via `onChange`, and ⌘/Ctrl-S
 * fires `onSave` (the broker-gated write). Without `onChange` (the mock
 * snapshot, always so in the visual harness) the view stays read-only, so the
 * pixel goldens are byte-identical.
 */
export function CodeMirrorView({
  doc,
  onChange,
  onSave,
}: {
  doc: EditorDoc;
  /** Push buffer updates as the user types (P2). Read-only when omitted. */
  onChange?: (text: string) => void;
  /** ⌘/Ctrl-S handler (P2 save). */
  onSave?: () => void;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);
  // Keep the latest callbacks reachable from the (stable) CM6 extensions
  // without re-mounting the view on every render. Updated in an effect (never
  // during render) so the ref stays a side-channel for the imperative editor.
  const onChangeRef = React.useRef(onChange);
  const onSaveRef = React.useRef(onSave);
  React.useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  });

  const editable = !!onChange;

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const folds = editorSnapshot.getFolds(doc.file);
    const bars = editorSnapshot.getChangeBars(doc.file);

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        preventDefault: true,
        run: () => {
          onSaveRef.current?.();
          return true;
        },
      },
    ]);

    // P5 — real LSP autocomplete, only on an editable real-file doc with a live
    // sidecar (browser/mock read-only path is untouched → goldens byte-stable).
    const lspCtx: LspEditorContext = {
      file: doc.file,
      root: () => useOpenProject.getState().project?.path,
    };
    const lspExtensions: Extension[] = editable ? [lspAutocomplete(lspCtx)] : [];
    if (editable) lspOpenDoc(lspCtx, doc.text);

    const state = EditorState.create({
      doc: doc.text,
      extensions: [
        EditorState.readOnly.of(!editable),
        EditorView.editable.of(editable),
        EditorView.contentAttributes.of({ "aria-label": `${doc.file} source` }),
        // Push edits up to the store (P2). No-op for the read-only mock path.
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
        }),
        saveKeymap,
        lineNumbers(),
        changeBarGutter(bars),
        codeFolding(),
        providerFolds(folds),
        foldGutter(),
        keymap.of(foldKeymap),
        languageForFile(doc.file),
        capiscoTheme,
        capiscoSyntax,
        rainbowBrackets,
        rainbowBracketTheme,
        indentGuides,
        indentGuideTheme,
        ...lspExtensions,
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // `editable` is derived from whether onChange is present; the doc identity
    // (file + initial text) drives re-mounts. Callback identity is ref-tracked.
  }, [doc.file, doc.text, editable]);

  return (
    <div
      ref={hostRef}
      data-testid="cm-editor"
      data-file={doc.file}
      data-editable={editable || undefined}
      role="presentation"
      className="relative min-h-0 flex-1 overflow-hidden"
    />
  );
}
