/**
 * Single autocomplete tokenizer (road-to-composer-intelligence P0). ONE parser
 * for every trigger — `@`-mentions and `/`-commands share this detector so two
 * forked parsers can never race on the same caret (the "`@`-mention breaks
 * after a slash-command" bug class is structurally impossible).
 *
 * Pure + browser-safe — no DOM, no I/O, deterministic. The autocomplete engine
 * is the ONLY caller; providers never tokenize.
 *
 * `@` rules mirror the original `activeMention` exactly (kept in `mention-query.ts`
 * for its direct golden tests); `/` is a strict, separate rule: only a `/` that
 * is the first non-whitespace char of its line opens a command token, so a `/`
 * inside a path (`@org/repo`, `a/b`) is never mistaken for a trigger.
 */

export type TriggerChar = "@" | "/";

/** An active autocomplete token the caret currently sits inside. */
export interface ActiveToken {
  /** Which trigger opened this token. */
  trigger: TriggerChar;
  /** Text typed after the trigger (may be empty right after the trigger char). */
  query: string;
  /** Index of the trigger char in the buffer (inclusive). */
  start: number;
  /** Index just past the caret / token end (exclusive). */
  end: number;
}

/**
 * Characters that may appear in a token body (after the trigger). `/` IS a body
 * char (project paths `@org/repo`, command names), so the left-walk does not
 * stop on it — only `@` (an explicit mention trigger) and whitespace/separators
 * stop the walk. A space closes a token.
 */
function isTokenBodyChar(ch: string): boolean {
  return /[\w.\-/:]/.test(ch);
}

function isSpace(ch: string): boolean {
  return /\s/.test(ch);
}

/**
 * Detect the active autocomplete token the caret sits inside, or null.
 *
 * - `@` — opens at buffer start or after whitespace (so `email@host` never
 *   triggers); body chars `[\w.\-/:]` (a `/` inside is a path segment, kept).
 * - `/` — opens ONLY when it is the first non-whitespace character of its line
 *   (or at buffer start); a `/` anywhere else is literal text, never a trigger.
 *
 * Because `/` is a body char, a single left-walk handles both: it stops at the
 * first `@` (→ mention, query may contain `/`) or at a non-body boundary; only
 * then is a leading `/` of the run considered as a command trigger. This is why
 * "`@` breaks after a slash-command" cannot happen — one parser, one result.
 */
export function detectToken(text: string, caret: number): ActiveToken | null {
  if (caret < 0 || caret > text.length) return null;

  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      // `@` mention — must be at buffer start or preceded by whitespace.
      if (i > 0 && !isSpace(text[i - 1])) return null;
      return { trigger: "@", query: text.slice(i + 1, caret), start: i, end: caret };
    }
    if (!isTokenBodyChar(ch)) break; // whitespace / separator closes the run
    i--;
  }

  // No `@` found. The run is text[runStart..caret]; a leading `/` at line-start
  // is a command trigger.
  const runStart = i + 1;
  if (text[runStart] === "/") {
    const lineStart = text.lastIndexOf("\n", runStart - 1) + 1; // 0 when no prior newline
    if (text.slice(lineStart, runStart).trim().length === 0) {
      return {
        trigger: "/",
        query: text.slice(runStart + 1, caret),
        start: runStart,
        end: caret,
      };
    }
  }
  return null;
}
