/**
 * Markdown ToDo parser (B3 Phase 2, concept §4.11). Pure + browser-safe — the
 * markdown editor calls it on the open buffer to surface clickable `- [ ]`
 * items. No Node, no DOM; deterministic.
 *
 * Recognises GitHub-style task list items at the start of a line (optionally
 * indented), with `[ ]` (open) or `[x]`/`[X]` (checked). Ordered list markers
 * (`1.`) and `*`/`+` bullets are also accepted.
 */

import type { TodoItem, TodoParser } from "@/contracts";

/** `  - [ ] text` / `* [x] text` / `1. [ ] text` (indent + marker + checkbox). */
const TODO_LINE = /^\s*(?:[-*+]|\d+\.)\s+\[([ xX])\]\s+(.*\S)\s*$/;

export function parseTodos(filePath: string, markdown: string): TodoItem[] {
  const items: TodoItem[] = [];
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = TODO_LINE.exec(lines[i]);
    if (!m) continue;
    const checked = m[1].toLowerCase() === "x";
    items.push({
      id: `${filePath}:${i + 1}`,
      text: m[2],
      checked,
      line: i + 1,
    });
  }
  return items;
}

export const markdownTodoParser: TodoParser = {
  parse: parseTodos,
};
