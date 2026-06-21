/**
 * Pure long-tail observation parser (Phase 3, token-economy). The deterministic,
 * spawn-free half of the RTK path — golden-tested against frozen long-tail
 * fixtures at a pinned RTK version (the parser test).
 *
 * The real `rtk` binary compresses on its own; this pure parser is what Capisco
 * controls and can pin deterministically: it normalizes raw long-tail CLI output
 * into a compact, stable shape (collapse blank runs, trim trailing whitespace,
 * drop noise lines, cap the tail) WITHOUT a process spawn. It is used by the
 * golden test (input fixture → expected compact output) and is a safe local
 * fallback shape; the live binary is the swap that does the heavier lifting.
 *
 * PURE + DETERMINISTIC: no I/O, no Date.now/Math.random. Same input → same output.
 */

export interface LongTailParseResult {
  /** The compacted text. */
  text: string;
  /** Lines in the raw input. */
  rawLines: number;
  /** Lines in the compacted output. */
  outputLines: number;
}

/** Lines that are pure noise in long-tail output (dropped). */
const NOISE_LINE = /^\s*(total\s+\d+|\.{1,2}\/?)\s*$/;

/**
 * Normalize raw long-tail output into a compact, stable form:
 *  - drop trailing whitespace per line,
 *  - drop known noise lines (`total N`, bare `.`/`..`),
 *  - collapse runs of ≥2 blank lines to a single blank,
 *  - trim leading/trailing blank lines.
 * Order-preserving and idempotent.
 */
export function parseLongTail(raw: string): LongTailParseResult {
  const rawLines = raw.length === 0 ? 0 : raw.split("\n").length;
  const lines = raw.split("\n").map((l) => l.replace(/[ \t]+$/g, ""));
  const kept: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (NOISE_LINE.test(line)) continue;
    if (line.trim() === "") {
      blankRun += 1;
      if (blankRun > 1) continue; // collapse ≥2 blanks to one
      kept.push("");
      continue;
    }
    blankRun = 0;
    kept.push(line);
  }
  // Trim leading/trailing blanks.
  while (kept.length && kept[0] === "") kept.shift();
  while (kept.length && kept[kept.length - 1] === "") kept.pop();
  const text = kept.join("\n");
  return {
    text,
    rawLines,
    outputLines: text.length === 0 ? 0 : text.split("\n").length,
  };
}
