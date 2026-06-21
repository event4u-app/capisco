/**
 * Vendored compression ruleset (Phase 0, token-economy P0).
 *
 * A "caveman-compress"-equivalent ruleset: a deterministic, pure list of word /
 * phrase reductions that drop low-information filler from carried context and
 * handoff summaries WITHOUT changing the load-bearing tokens. It is the
 * vocabulary half of {@link compressMemory}; the protected-token masking half
 * lives in `memory-compress.ts`.
 *
 * ─── ATTRIBUTION ────────────────────────────────────────────────────────────
 * Adapted from the MIT-licensed `caveman-compress` ruleset idiom (a token-saving
 * text compressor that reduces prose to a terse, telegraphic form while leaving
 * code, URLs, and paths byte-identical). This is a clean-room re-expression of
 * the RULE SHAPE (article/auxiliary/filler elision + safe phrase contractions),
 * vendored here as data — not a fork of any installer or runtime. The behaviour
 * is what we adopt; the implementation is ours.
 *
 *   SPDX-License-Identifier: MIT
 *   Vendored ruleset — see DECISIONS.md "Memory-Kompression".
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HARD INVARIANT (tested in `memory-compress.test.ts`): a rule may only ever
 * REMOVE or SHORTEN filler tokens. No rule may touch a number, an identifier, a
 * negation word (`not`/`no`/`never`/`don't`), or anything inside a protected
 * span. The masking layer guarantees code/URLs/paths are never seen by these
 * rules at all (they are replaced by opaque sentinels before the rules run).
 */

/** One compression rule: a global regex and its replacement. */
export interface CompressRule {
  /** Stable id (for the rule-count assertion + debugging). */
  id: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Filler words that carry no information in a carried-context summary. Dropped
 * only as WHOLE words (`\b…\b`), case-insensitive, never inside another token.
 * Deliberately conservative: negations, numbers, and identifiers are NOT here.
 */
const FILLER_WORDS = [
  "the",
  "a",
  "an",
  "that",
  "which",
  "just",
  "really",
  "very",
  "quite",
  "actually",
  "basically",
  "simply",
  "in order to",
  "as well",
  "of course",
];

/**
 * Linking auxiliaries that are safe to drop in telegraphic prose. NEVER includes
 * a negated form ("is not" stays — the negation is load-bearing); the patterns
 * below require the auxiliary to be followed by a non-negation word.
 */
const SAFE_AUXILIARIES = ["is", "are", "was", "were", "be", "been", "being"];

/** Phrase contractions — verbose → terse, meaning-preserving. */
const PHRASE_CONTRACTIONS: Array<[from: string, to: string]> = [
  ["in order to", "to"],
  ["due to the fact that", "because"],
  ["at this point in time", "now"],
  ["in the event that", "if"],
  ["for the purpose of", "for"],
  ["with regard to", "re"],
  ["a number of", "several"],
  ["the majority of", "most"],
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The vendored ruleset, built once. Order matters: phrase contractions run
 * before single-word elision so a multi-word phrase is collapsed as a unit.
 */
export const CAVEMAN_RULESET: readonly CompressRule[] = buildRuleset();

function buildRuleset(): CompressRule[] {
  const rules: CompressRule[] = [];

  // 1. Phrase contractions (multi-word → terse), case-insensitive whole-phrase.
  for (const [from, to] of PHRASE_CONTRACTIONS) {
    rules.push({
      id: `phrase:${from}`,
      pattern: new RegExp(`\\b${escapeRegExp(from)}\\b`, "gi"),
      replacement: to,
    });
  }

  // 2. Drop safe auxiliaries ONLY when not negated: `is fast` → `fast`, but
  //    `is not fast` is left untouched (negation follows → no match).
  for (const aux of SAFE_AUXILIARIES) {
    rules.push({
      id: `aux:${aux}`,
      // `aux` + space, NOT followed by a negation token. Drops the auxiliary.
      pattern: new RegExp(`\\b${aux}\\b(?!\\s+(?:not|no|never|n't)\\b)\\s+`, "gi"),
      replacement: "",
    });
  }

  // 3. Drop filler words as whole words. Run AFTER auxiliaries so "the" left by
  //    an elided auxiliary is still caught.
  for (const word of FILLER_WORDS) {
    rules.push({
      id: `filler:${word}`,
      pattern: new RegExp(`\\b${escapeRegExp(word)}\\b\\s*`, "gi"),
      replacement: "",
    });
  }

  return rules;
}
