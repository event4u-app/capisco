/**
 * Quality-driven escalation (road-to-model-routing P1 — "B5 as router feedback",
 * the Capisco-specific answer to model-routing). The elegant pattern is NOT
 * "guess the right tier once" — it is SMALL-FIRST, ESCALATE ON A GROUNDED SIGNAL:
 *
 *   1. Spawn the run at the small-first tier the {@link LiveModelRouter} decided
 *      for the origin.
 *   2. Run the QUALITY GATE (eslint / tsc / vitest — the B5 runner). A RED gate
 *      is the DETERMINISTIC signal "the small model was not enough" — a hard,
 *      grounded fact, NOT a vague confidence score.
 *   3. On RED, escalate one tier and RE-SPAWN, carrying the FAILING DIAGNOSTICS
 *      forward as context (the bigger model fixes against the real errors).
 *   4. Repeat until the gate is GREEN or the ceiling (`large`) is reached.
 *
 * THE HONEST COST (the roadmap's Klasse-C realism): an escalated run means the
 * underestimated case ran TWICE (small failed, then large) — the small attempt
 * is paid ON TOP. {@link EscalationOutcome.attempts} surfaces every run (tier +
 * model + verdict) so the double-run cost is VISIBLE, never hidden — net savings
 * only hold if most routed work is genuinely mechanical.
 *
 * NO REAL LLM HERE. The run is performed by an injected {@link RunSession} (the
 * deterministic stub in tests) and the verdict by an injected {@link QualityGate}
 * (a fake RED/GREEN verdict in tests / the real `QualityProvider.runAll` in
 * production). This module is the pure orchestration around those two seams.
 *
 * BLOCKLIST: a blocklisted origin starts at `large` (the ceiling), so there is
 * nothing to escalate from — escalation is structurally a no-op for it.
 */

import type { Diagnostic, ModelId, RoutingDecision, SessionOrigin } from "@/contracts";
import { tierLessThan } from "@/lib/model-routing/router.ts";
import type { LiveModelRouter } from "./live-router.ts";

/**
 * One quality verdict for a run. `failed` is the deterministic RED signal; the
 * `diagnostics` are the grounded errors carried forward on escalation. Mirrors
 * the shape `QualityProvider.runAll` → `QualityRunResult[]` folds into (a fake
 * supplies it directly in tests; production derives it from the real runner).
 */
export interface QualityVerdict {
  /** True when the quality gate is RED (at least one error-severity diagnostic). */
  failed: boolean;
  /** The failing diagnostics (carried forward as context on escalation). */
  diagnostics: Diagnostic[];
}

/**
 * Run a session at a resolved model and return the persistent session id. In
 * production this is a {@link TodoSessionStarter}-style broker-gated spawn; in
 * tests it is the deterministic stub. The `attempt` (0-based) lets a run vary by
 * pass (e.g. the escalated pass receives the error context in its prompt).
 */
export type RunSession = (input: {
  model: ModelId;
  prompt: string;
  attempt: number;
}) => Promise<string>;

/**
 * Produce a quality verdict for a completed run. Production wires the real B5
 * runner (`QualityProvider.runAll` → fold to a verdict); tests pass a fake that
 * returns a FORCED RED/GREEN so escalation is verified WITHOUT a real LLM or a
 * real (paid) escalation. `attempt` is the 0-based pass index.
 */
export type QualityGate = (input: {
  sessionId: string;
  model: ModelId;
  attempt: number;
}) => Promise<QualityVerdict> | QualityVerdict;

/** One attempt in an escalation chain — the audit/transparency record. */
export interface EscalationAttempt {
  /** 0-based pass index (0 = the small-first attempt). */
  attempt: number;
  /** The routing decision for this attempt (tier + blocklist + reason). */
  decision: RoutingDecision;
  /** The concrete model this attempt ran at. */
  model: ModelId;
  /** The session id the run produced. */
  sessionId: string;
  /** The quality verdict for this attempt (RED → escalates if not at ceiling). */
  verdict: QualityVerdict;
}

/** The outcome of a small-first-with-escalation run. */
export interface EscalationOutcome {
  /** The final (accepted) session id — the last attempt's run. */
  sessionId: string;
  /** The final model the work landed on. */
  model: ModelId;
  /** The final routing decision (carries `escalated-on-quality` when it stepped up). */
  decision: RoutingDecision;
  /** True when at least one escalation happened (the underestimated, double-run case). */
  escalated: boolean;
  /** Every attempt, in order — the VISIBLE double-run cost (small + … + large). */
  attempts: EscalationAttempt[];
}

/**
 * Build the escalation prompt for a re-spawn: the original prompt plus the
 * failing diagnostics as grounded context (the bigger model fixes against the
 * REAL errors, not a guess). Pure + deterministic — no diagnostic is invented,
 * the text is derived only from what the gate reported.
 */
export function buildEscalationPrompt(originalPrompt: string, diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return originalPrompt;
  const lines = diagnostics.map((d) => {
    const where = d.file ? `${d.file}${d.line ? `:${d.line}` : ""}` : "(run)";
    const rule = d.rule ? ` [${d.rule}]` : "";
    return `- ${d.tool} ${d.severity}${rule} at ${where}: ${d.message}`;
  });
  return (
    `${originalPrompt}\n\n` +
    `A smaller model attempted this and the quality gate failed. ` +
    `Fix these grounded errors:\n${lines.join("\n")}`
  );
}

/**
 * Small-first with quality-driven escalation. Resolves the origin decision via
 * the router (small-first when routing is on; large when off or blocklisted),
 * runs it, checks the gate, and on RED steps up one tier carrying the failing
 * diagnostics forward — until GREEN or the `large` ceiling.
 *
 * Deterministic given deterministic `runSession` + `gate` seams (the test path
 * passes a fake gate; no real LLM, no real escalation cost). The returned outcome
 * lists every attempt so the double-run cost is transparent.
 */
export async function runWithEscalation(input: {
  router: LiveModelRouter;
  origin: SessionOrigin;
  prompt: string;
  runSession: RunSession;
  gate: QualityGate;
}): Promise<EscalationOutcome> {
  const { router, origin, prompt, runSession, gate } = input;
  let decision = router.decide(origin);
  const attempts: EscalationAttempt[] = [];

  for (let attempt = 0; ; attempt++) {
    const model = router.modelFor(decision.tier);
    const runPrompt =
      attempt === 0
        ? prompt
        : buildEscalationPrompt(prompt, attempts[attempt - 1].verdict.diagnostics);
    const sessionId = await runSession({ model, prompt: runPrompt, attempt });
    const verdict = await gate({ sessionId, model, attempt });
    attempts.push({ attempt, decision, model, sessionId, verdict });

    // GREEN — accept this attempt.
    if (!verdict.failed) break;

    // RED — escalate one tier carrying the errors forward. At the ceiling
    // (`large`), escalation is a no-op: accept the best we have rather than spin.
    const escalated = router.escalateDecision(decision, true);
    if (!tierLessThan(decision.tier, escalated.tier)) break;
    decision = escalated;
  }

  const last = attempts[attempts.length - 1];
  return {
    sessionId: last.sessionId,
    model: last.model,
    decision: last.decision,
    escalated: attempts.length > 1,
    attempts,
  };
}

/**
 * Fold the real B5 runner's results into a {@link QualityVerdict} (production
 * wiring helper). RED ⇔ any error-severity diagnostic. Pure — exported so the
 * real-runner path and tests share one definition of "the gate is red".
 */
export function verdictFromResults(
  results: { ok: boolean; diagnostics: Diagnostic[] }[],
): QualityVerdict {
  const diagnostics = results.flatMap((r) => r.diagnostics);
  const failed = results.some((r) => !r.ok) || diagnostics.some((d) => d.severity === "error");
  return { failed, diagnostics: diagnostics.filter((d) => d.severity === "error") };
}
