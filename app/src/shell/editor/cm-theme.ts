import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * JetBrains-Dark CM6 theme — built from the Capisco design tokens (the
 * prototype's `.t-line` CSS cannot be applied to CM6, so this is an own
 * extension per roadmap Phase 0). Colors reference the live CSS custom
 * properties so the Light theme inverts for free.
 */
export const capiscoTheme = EditorView.theme(
  {
    "&": {
      color: "var(--syn-variable)",
      backgroundColor: "var(--bg-editor)",
      fontSize: "13px",
      height: "100%",
    },
    ".cm-content": {
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      lineHeight: "1.5",
      caretColor: "var(--accent)",
      padding: "4px 0",
    },
    ".cm-scroller": {
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      lineHeight: "1.5",
      overflow: "auto",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-gutters": {
      backgroundColor: "var(--bg-editor)",
      color: "var(--text-tertiary)",
      border: "none",
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: "12px",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      padding: "0 8px 0 12px",
      minWidth: "32px",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--text-secondary)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.025)" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--bg-selected)",
    },
    ".cm-foldGutter .cm-gutterElement": {
      cursor: "pointer",
      color: "var(--text-tertiary)",
      paddingRight: "2px",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--bg-hover)",
      border: "none",
      color: "var(--text-secondary)",
      borderRadius: "3px",
      margin: "0 2px",
      padding: "0 4px",
    },
  },
  { dark: true },
);

/** Muted (never neon) highlight style — values from tokens/syntax.css. */
export const capiscoHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier], color: "var(--syn-keyword)" },
  { tag: [t.controlKeyword, t.operatorKeyword], color: "var(--syn-control)" },
  { tag: [t.string, t.special(t.string)], color: "var(--syn-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--syn-number)" },
  {
    tag: [t.lineComment, t.blockComment, t.comment],
    color: "var(--syn-comment)",
    fontStyle: "italic",
  },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: "var(--syn-function)",
  },
  { tag: [t.typeName, t.className, t.namespace], color: "var(--syn-type)" },
  { tag: [t.variableName, t.definition(t.variableName)], color: "var(--syn-variable)" },
  { tag: [t.propertyName], color: "var(--syn-property)" },
  { tag: [t.operator, t.punctuation, t.separator], color: "var(--syn-operator)" },
]);

export const capiscoSyntax = syntaxHighlighting(capiscoHighlight);
