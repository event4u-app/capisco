/**
 * Deterministic AI-review fake (B5 Phase 1, road-to-quality-grounding).
 *
 * The "tools first, then LLM on tool facts" loop, with the LLM call DEFERRED
 * (needs keys — overview §5). This fake implements the {@link AiReviewProvider}
 * contract by deriving the review **purely from the tool facts it is handed** —
 * exactly the discipline the real LLM provider must honour: it never references
 * a finding the tools did not report. The real provider is a thin swap behind
 * the same interface; until then this proves the loop end-to-end without a key.
 *
 * Determinism: no Date.now / Math.random / network. Same diagnostics in → same
 * review out (tested).
 *
 * Security: the review carries no executable action. Any fix it surfaces is a
 * fact for a human-gated apply through the broker — never auto-fired. The tool
 * facts are trusted (first-party); a real LLM's prose would be untrusted output
 * (lethal-trifecta) and must not become an instruction.
 */

import type {
  AiReview,
  AiReviewProvider,
  Diagnostic,
  QualityRunResult,
  ReviewedFinding,
} from "@/contracts";

/** A short grounded comment for one diagnostic — derived, not invented. */
function commentFor(d: Diagnostic): string {
  const where = d.file ? `${d.file}${d.line ? `:${d.line}` : ""}` : "this run";
  if (d.fix?.autoApplicable) {
    return `${d.tool} flags ${d.rule ?? "an issue"} at ${where}; an automatic fix is available.`;
  }
  if (d.severity === "error") {
    return `${d.tool} reports an error (${d.rule ?? "no rule id"}) at ${where} — must be resolved.`;
  }
  return `${d.tool} reports a ${d.severity} (${d.rule ?? "no rule id"}) at ${where}.`;
}

export class FakeAiReviewProvider implements AiReviewProvider {
  async review(results: QualityRunResult[]): Promise<AiReview> {
    const diagnostics = results.flatMap((r) => r.diagnostics);
    const errorCount = diagnostics.filter((d) => d.severity === "error").length;
    const warningCount = diagnostics.filter((d) => d.severity === "warning").length;

    const findings: ReviewedFinding[] = diagnostics.map((d) => ({
      diagnostic: d,
      comment: commentFor(d),
    }));

    let summary: string;
    if (diagnostics.length === 0) {
      summary = `All ${results.length} tool${results.length === 1 ? "" : "s"} passed clean — no diagnostics to ground a review on.`;
    } else {
      const tools = [...new Set(diagnostics.map((d) => d.tool))].join(", ");
      const fixable = diagnostics.filter((d) => d.fix?.autoApplicable).length;
      summary =
        `${errorCount} error${errorCount === 1 ? "" : "s"}, ${warningCount} warning${warningCount === 1 ? "" : "s"} ` +
        `from ${tools}${fixable ? `; ${fixable} auto-fixable` : ""}. Review grounded in tool facts only.`;
    }

    return { provider: "fake", summary, findings, errorCount, warningCount };
  }
}
