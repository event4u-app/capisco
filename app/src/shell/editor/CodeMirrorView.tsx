import * as React from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  lineNumbers,
  gutter,
  GutterMarker,
} from "@codemirror/view";
import { foldGutter, codeFolding, foldKeymap, foldService } from "@codemirror/language";
import { keymap } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";

import type { ChangeBar, EditorDoc, FoldRange } from "@/contracts";
import { mockEditorProvider } from "@/mocks";
import {
  capiscoTheme,
  capiscoSyntax,
} from "./cm-theme";
import {
  rainbowBrackets,
  rainbowBracketTheme,
  indentGuides,
  indentGuideTheme,
} from "./cm-extensions";

/** Git change-bar gutter marker (Modified amber / Added green / Deleted red). */
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
 * CodeMirror 6 read-only mount (roadmap Phase 0). Renders the mock EditorDoc
 * with the JetBrains-dark theme, muted syntax highlighting, rainbow brackets,
 * indent guides, code folding (ranges from the mock provider) and a git
 * change-bar gutter. Read-only: production datasource is read-only invariant +
 * this is a fidelity shell, not an editing surface.
 */
export function CodeMirrorView({ doc }: { doc: EditorDoc }) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const viewRef = React.useRef<EditorView | null>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const folds = mockEditorProvider.getFolds(doc.file);
    const bars = mockEditorProvider.getChangeBars(doc.file);

    const state = EditorState.create({
      doc: doc.text,
      extensions: [
        EditorState.readOnly.of(true),
        EditorView.editable.of(false),
        EditorView.contentAttributes.of({ "aria-label": `${doc.file} source` }),
        lineNumbers(),
        changeBarGutter(bars),
        codeFolding(),
        providerFolds(folds),
        foldGutter(),
        keymap.of(foldKeymap),
        javascript({ typescript: true }),
        capiscoTheme,
        capiscoSyntax,
        rainbowBrackets,
        rainbowBracketTheme,
        indentGuides,
        indentGuideTheme,
      ],
    });
    const view = new EditorView({ state, parent: host });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [doc.file, doc.text]);

  return (
    <div
      ref={hostRef}
      data-testid="cm-editor"
      data-file={doc.file}
      role="presentation"
      className="relative min-h-0 flex-1 overflow-hidden"
    />
  );
}
