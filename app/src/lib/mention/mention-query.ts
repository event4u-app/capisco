/**
 * `@project` mention query helpers (road-to-cross-project-knowledge P1). Pure +
 * browser-safe — no DOM, no I/O, deterministic. The composer autocomplete and
 * its tests both drive these functions; the React surface only renders what
 * they decide.
 *
 * Scope (deliberately narrow, per `feature-ide-linking.txt` round 3): this is
 * autocomplete over a short list of project NAMES from the recent-projects
 * registry — never methods/symbols (that is an explicit later phase). The
 * resulting reference knows the project's on-disk path so a click can open it.
 */

import type { RecentProject } from "@/contracts";

/** An active `@token` the caret currently sits in, parsed out of the buffer. */
export interface MentionContext {
  /** The query string after `@` (may be empty right after typing `@`). */
  query: string;
  /** Index of the `@` in the text (inclusive). */
  start: number;
  /** Index just past the caret / token end (exclusive). */
  end: number;
}

/**
 * Detect the `@project` token the caret sits inside, if any. Returns null when
 * the caret is not in a mention.
 *
 * A mention starts at an `@` that is at the buffer start or preceded by
 * whitespace (so an email-ish `a@b` never triggers). The token runs from the
 * `@` up to the caret and may contain only "project name" characters
 * (word chars, `-`, `.`, `/`); a space closes it. The caret must sit within
 * `@…` for the token to be active.
 */
export function activeMention(text: string, caret: number): MentionContext | null {
  if (caret < 0 || caret > text.length) return null;
  // Walk left from the caret to find an `@` that opens a token. Stop at
  // whitespace (token boundary) or a character that cannot be in a name.
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") break;
    if (!isNameChar(ch)) return null; // hit a separator before any `@`
    i--;
  }
  if (i < 0 || text[i] !== "@") return null;
  // `@` must be at start or preceded by whitespace (not `email@host`).
  if (i > 0 && !isSpace(text[i - 1])) return null;
  const query = text.slice(i + 1, caret);
  return { query, start: i, end: caret };
}

/**
 * Filter + rank the registry for a mention query. Case-insensitive substring
 * match on the project NAME; ranked most-recent-first by the deterministic
 * `lastSeen` ordinal (name tiebreak for stability). An empty query lists all.
 *
 * `excludeName` drops the current project so you never `@`-mention yourself.
 */
export function matchProjects(
  projects: RecentProject[],
  query: string,
  excludeName?: string,
): RecentProject[] {
  const q = query.trim().toLowerCase();
  return projects
    .filter((p) => p.name !== excludeName)
    .filter((p) => q === "" || p.name.toLowerCase().includes(q))
    .sort((a, b) => b.lastSeen - a.lastSeen || a.name.localeCompare(b.name));
}

/**
 * Replace the active mention in `text` with a canonical `@name ` reference and
 * report the new caret position (just past the inserted trailing space). Pure —
 * the caller writes the result back into the input.
 */
export function insertReference(
  text: string,
  mention: MentionContext,
  project: RecentProject,
): { text: string; caret: number } {
  const ref = `@${project.name} `;
  const next = text.slice(0, mention.start) + ref + text.slice(mention.end);
  return { text: next, caret: mention.start + ref.length };
}

/** Word-ish characters that may appear in a project name token. */
function isNameChar(ch: string): boolean {
  return /[\w.\-/]/.test(ch);
}

function isSpace(ch: string): boolean {
  return /\s/.test(ch);
}
