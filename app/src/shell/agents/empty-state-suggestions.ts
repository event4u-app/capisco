/**
 * Empty-State next-task suggestions (composer-intelligence P3) — the PURE,
 * deterministic builder. Given already-resolved (synchronous) state, it returns
 * 3–5 mode-filtered suggestion rows for the empty composer. No React, no async,
 * no side effects → the same inputs always produce the same rows, which keeps
 * the boot-visible empty-input render deterministic (no golden flicker).
 *
 * Sources that ship (all read synchronously — see `use-empty-state-suggestions`):
 *   - recent prompts (P4 per-session prompt-log)         — both modes
 *   - the open / dirty editor file                        — agent mode only
 *   - the current git branch + changed-file count         — agent mode only
 *   - an unchecked ToDo parsed from the frontmost doc      — both modes
 *
 * Deliberately NOT sourced: "last failed test". The QualityProvider is fully
 * async with no synchronous snapshot facade (unlike `editorSnapshot` /
 * `gitSnapshot`); faking it would break the pure/deterministic contract. When a
 * synchronous quality snapshot lands, add a `lastFailedDiagnostic` source here.
 */

import type { EditorDoc } from "@/contracts";
import { parseTodos } from "@/lib/todo/todo-parser";

export type SuggestionKind = "recent-prompt" | "open-file" | "git-branch" | "open-todo";

export interface Suggestion {
  /** Stable across re-builds (kind-scoped) so React keys never churn. */
  id: string;
  kind: SuggestionKind;
  /** Short one-line display label. */
  label: string;
  /** The text written into the composer on click (never auto-sent). */
  fill: string;
}

export interface SuggestionSources {
  /** Most-recent-FIRST sent prompts for the active session (P4). */
  recentPrompts: string[];
  /** Open editor docs, `[0]` = frontmost/pinned. */
  editorDocs: EditorDoc[];
  /** Current git branch name (empty string when unknown). */
  currentBranch: string;
  /** Number of changed files on the branch. */
  changedFileCount: number;
  /** Chat surface (no tools) → file/git suggestions are suppressed. */
  isChat: boolean;
}

const MAX_ROWS = 5;
const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/**
 * Build the capped, mode-filtered suggestion list. Order is relevance-first:
 * the two most-recent prompts, then the open file, then the branch summary, then
 * one open ToDo. Returns `[]` when nothing is available (the caller renders no
 * block). PURE.
 */
export function buildEmptyStateSuggestions(sources: SuggestionSources): Suggestion[] {
  const rows: Suggestion[] = [];

  // 1 — recent prompts (both modes): the user literally just sent these.
  sources.recentPrompts.slice(0, 2).forEach((text, i) => {
    rows.push({
      id: `recent-${i}`,
      kind: "recent-prompt",
      label: truncate(text, 60),
      fill: text,
    });
  });

  // 2 — open / dirty editor file (agent mode only — chat has no tools).
  if (!sources.isChat && sources.editorDocs.length > 0) {
    const target = sources.editorDocs.find((d) => d.dirty) ?? sources.editorDocs[0]!;
    rows.push({
      id: "open-file",
      kind: "open-file",
      label: `Review changes in ${target.file}`,
      fill: `Review the recent changes in ${target.file} and suggest improvements`,
    });
  }

  // 3 — current branch + changed files (agent mode only).
  if (!sources.isChat && sources.currentBranch && sources.changedFileCount > 0) {
    const n = sources.changedFileCount;
    rows.push({
      id: "git-branch",
      kind: "git-branch",
      label: `Summarise ${n} change${n === 1 ? "" : "s"} on ${sources.currentBranch}`,
      fill: `Summarise the ${n} changed file${n === 1 ? "" : "s"} on branch ${sources.currentBranch} and check for issues`,
    });
  }

  // 4 — one unchecked ToDo from the frontmost open doc (both modes).
  if (rows.length < MAX_ROWS && sources.editorDocs.length > 0) {
    const front = sources.editorDocs[0]!;
    const todo = parseTodos(front.file, front.text).find((t) => !t.checked);
    if (todo) {
      rows.push({
        id: "open-todo",
        kind: "open-todo",
        label: `ToDo: ${truncate(todo.text, 50)}`,
        fill: todo.text,
      });
    }
  }

  return rows.slice(0, MAX_ROWS);
}
