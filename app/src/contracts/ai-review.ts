/**
 * AI-review-loop contract (B5 Phase 1, road-to-quality-grounding).
 *
 * The honest shape of "grounding": the loop runs the quality TOOLS FIRST
 * (real, verifiable — eslint/tsc/vitest via {@link QualityProvider}), then
 * feeds those structured tool FACTS to an LLM for a review summary. The tool
 * facts are the ground truth; the LLM only reasons over them — it never invents
 * a diagnostic the tools did not report.
 *
 * The real LLM call is **deferred** (needs API keys — overview §5). What ships
 * is this INTERFACE plus a deterministic {@link AiReviewProvider} fake
 * (`FakeAiReviewProvider`) that derives its review purely from the tool facts,
 * so the loop is exercised end-to-end without a key. The real provider is a thin
 * swap behind the same contract.
 *
 * Security posture (overview §3.3, lethal-trifecta): the LLM output is
 * **untrusted data, never instructions**. A review never carries an executable
 * action; any fix it references is surfaced as a fact for a human-gated apply
 * through the broker, never auto-fired.
 */

import type { Diagnostic, QualityRunResult } from "./quality.ts";

/** A single reviewed finding — a tool diagnostic the LLM commented on. The
 * diagnostic is the GROUND (from the tools); `comment` is the LLM layer. */
export interface ReviewedFinding {
  /** The tool fact this comment is grounded in. */
  diagnostic: Diagnostic;
  /** The LLM's grounded comment about this specific diagnostic. */
  comment: string;
}

/** The result of one grounded review pass. */
export interface AiReview {
  /** Which provider produced it — "fake" until a real LLM is wired. */
  provider: "fake" | "llm";
  /** One-line headline summary grounded in the tool facts. */
  summary: string;
  /** Per-diagnostic grounded comments (only for diagnostics the tools found). */
  findings: ReviewedFinding[];
  /** Total error/warning counts the review is grounded in (never a guess). */
  errorCount: number;
  warningCount: number;
}

/**
 * The "tools first, then LLM on tool facts" review seam. The caller supplies
 * the real {@link QualityRunResult}s (already produced by the runner); the
 * provider reviews *those facts*. It is given no ability to run tools or read
 * files — it reviews the facts it is handed, nothing more (least-agency).
 */
export interface AiReviewProvider {
  /**
   * Produce a grounded review of the given tool results. The real impl prompts
   * an LLM with the diagnostics; the fake derives the review deterministically
   * from the same facts. Either way the review is bounded by the diagnostics —
   * it cannot reference a finding the tools did not report.
   */
  review(results: QualityRunResult[]): Promise<AiReview>;
}
