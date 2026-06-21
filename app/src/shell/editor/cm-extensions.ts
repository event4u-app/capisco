import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

/**
 * Rainbow brackets (teal → violet → orange → gray) as a CM6 ViewPlugin.
 * Each open bracket gets a depth-cycled mark; the matching close mirrors it.
 * The four colours come from tokens/syntax.css (--bracket-1..4).
 */
const BRACKET_OPEN = "([{";
const BRACKET_CLOSE = ")]}";

function bracketMark(depth: number) {
  const idx = (depth % 4) + 1;
  return Decoration.mark({ class: `cm-bracket cm-bracket-${idx}` });
}

export const rainbowBrackets = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view);
    }
    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);
        // Track depth across the visible slice; bracket-matching ignores strings
        // for this calm mock (the prototype hand-coloured them the same way).
        let depth = 0;
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          if (BRACKET_OPEN.includes(ch)) {
            builder.add(from + i, from + i + 1, bracketMark(depth));
            depth++;
          } else if (BRACKET_CLOSE.includes(ch)) {
            depth = Math.max(0, depth - 1);
            builder.add(from + i, from + i + 1, bracketMark(depth));
          }
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

export const rainbowBracketTheme = EditorView.baseTheme({
  ".cm-bracket-1": { color: "var(--bracket-1)" },
  ".cm-bracket-2": { color: "var(--bracket-2)" },
  ".cm-bracket-3": { color: "var(--bracket-3)" },
  ".cm-bracket-4": { color: "var(--bracket-4)" },
});

/**
 * Indent guides — a line decoration drawing a rail per indent level. The block
 * containing the active line is highlighted (--indent-guide-active).
 */
class IndentGuideWidget extends WidgetType {
  readonly levels: number;
  readonly activeLevel: number;
  constructor(levels: number, activeLevel: number) {
    super();
    this.levels = levels;
    this.activeLevel = activeLevel;
  }
  eq(o: IndentGuideWidget) {
    return o.levels === this.levels && o.activeLevel === this.activeLevel;
  }
  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-indent-guides";
    wrap.setAttribute("aria-hidden", "true");
    for (let i = 0; i < this.levels; i++) {
      const g = document.createElement("span");
      g.className = "cm-indent-guide" + (i === this.activeLevel ? " cm-indent-guide-active" : "");
      wrap.appendChild(g);
    }
    return wrap;
  }
}

const TAB_SIZE = 2;

function leadingIndentLevels(line: string): number {
  let n = 0;
  while (n < line.length && line[n] === " ") n++;
  return Math.floor(n / TAB_SIZE);
}

export const indentGuides = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet)
        this.decorations = this.build(u.view);
    }
    build(view: EditorView): DecorationSet {
      const builder = new RangeSetBuilder<Decoration>();
      const doc = view.state.doc;
      const head = view.state.selection.main.head;
      const activeLineNo = doc.lineAt(head).number;
      const activeText = doc.line(activeLineNo).text;
      const activeBlockLevel = Math.max(0, leadingIndentLevels(activeText) - 1);
      for (const { from, to } of view.visibleRanges) {
        let pos = from;
        while (pos <= to) {
          const line = doc.lineAt(pos);
          const levels = leadingIndentLevels(line.text);
          if (levels > 0) {
            const onActiveBlock = line.number === activeLineNo;
            builder.add(
              line.from,
              line.from,
              Decoration.widget({
                widget: new IndentGuideWidget(levels, onActiveBlock ? activeBlockLevel : -1),
                side: -1,
              }),
            );
          }
          if (line.to + 1 > to) break;
          pos = line.to + 1;
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

export const indentGuideTheme = EditorView.baseTheme({
  ".cm-indent-guides": {
    position: "absolute",
    left: "0",
    top: "0",
    height: "100%",
    display: "flex",
    pointerEvents: "none",
  },
  ".cm-indent-guide": {
    display: "inline-block",
    width: `${TAB_SIZE}ch`,
    height: "100%",
    boxShadow: "inset 1px 0 0 0 var(--indent-guide)",
  },
  ".cm-indent-guide-active": {
    boxShadow: "inset 1px 0 0 0 var(--indent-guide-active)",
  },
});
