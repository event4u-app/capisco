/**
 * Real quality-gate wiring (road-to-real-runtime P2) — binds the escalation
 * loop's {@link QualityGate} seam to the REAL B5 runner
 * (`QualityProvider.runAll` → {@link verdictFromResults}). This is the
 * production glue the escalation module leaves abstract on purpose:
 * `escalation.ts` stays pure orchestration (no provider import, no real tools),
 * and THIS module is the one place the real eslint / tsc / vitest verdicts feed
 * the small-first-escalate loop — carrying the REAL failing diagnostics forward
 * as the bigger model's grounded context.
 *
 * What stays out: the model-spawn seam ({@link RunSession}) is NOT wired here —
 * it needs real model calls / API keys and stays the operator-gated half. This
 * module is the autonomous, real, fixture-verifiable half: given a worktree with
 * a real lint / type error the gate is RED with the real diagnostics; a clean
 * worktree is GREEN. The gate re-runs the tools on each call, so after every
 * re-spawn the (now-edited) worktree is freshly graded.
 */

import type { QualityProvider, QualityRunOptions, QualityToolId } from "@/contracts";
import { verdictFromResults, type QualityGate } from "./escalation.ts";

/**
 * Build a {@link QualityGate} that grades a worktree with the real quality
 * runner. By default it runs the provider's full available tool set
 * (`runAll`); pass `tools` to pin a subset (hermetic tests, or a pack-scoped
 * gate). The verdict is RED when any tool failed or any error-severity
 * diagnostic is present — the same definition the escalation loop uses.
 */
export function realQualityGate(input: {
  provider: Pick<QualityProvider, "run" | "runAll">;
  /** The worktree to grade (the directory the session edited). */
  cwd: string;
  /** Restrict to these tools; omit to use the provider's full available set. */
  tools?: QualityToolId[];
  options?: QualityRunOptions;
}): QualityGate {
  const { provider, cwd, tools, options } = input;
  return async () => {
    const results =
      tools && tools.length > 0
        ? await Promise.all(tools.map((tool) => provider.run(cwd, tool, options)))
        : await provider.runAll(cwd, options);
    return verdictFromResults(results);
  };
}
