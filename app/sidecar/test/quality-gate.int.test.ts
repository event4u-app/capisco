/**
 * Real quality-gate wiring (road-to-real-runtime P2). Proves the escalation
 * loop's QualityGate seam, when bound to the REAL B5 runner, produces grounded
 * RED/GREEN verdicts AND that those real diagnostics flow into the escalation
 * re-spawn prompt — WITHOUT a real LLM (the model-spawn seam stays a stub).
 *
 *  - Gate over a real eslint fixture (prefer-const error) → RED with the real
 *    diagnostic; clean fixture → GREEN; tsc type-error fixture → RED.
 *  - Escalation driven by the REAL gate over a red worktree → climbs to the
 *    ceiling carrying the REAL eslint rule forward in the bigger model's prompt.
 *
 * Hermetic: real eslint/tsc binaries run against throwaway temp worktrees (the
 * same fixtures as real-quality-provider.test.ts). No network, no LLM, no keys.
 */

import { describe, expect, it } from "vitest";

import { RealQualityProvider } from "../quality/real-quality-provider.ts";
import { LiveModelRouter } from "../model-routing/live-router.ts";
import { realQualityGate } from "../model-routing/quality-gate.ts";
import { runWithEscalation, type RunSession } from "../model-routing/escalation.ts";
import type { SessionOrigin } from "@/contracts";
import {
  makeCleanEslintFixture,
  makeEslintFixture,
  makeTscFixture,
} from "./quality-fixture.ts";

const provider = new RealQualityProvider();
const TODO: SessionOrigin = { kind: "todo" };

/** A no-LLM run seam: records the prompt each attempt saw, returns a fake id. */
function stubRunner(): { runSession: RunSession; prompts: string[] } {
  const prompts: string[] = [];
  let n = 0;
  const runSession: RunSession = async ({ prompt }) => {
    prompts.push(prompt);
    return `stub-session-${n++}`;
  };
  return { runSession, prompts };
}

describe("realQualityGate — grades a worktree with the real B5 runner", () => {
  it("is RED with the real eslint diagnostic on a prefer-const error", async () => {
    const wt = makeEslintFixture();
    try {
      const gate = realQualityGate({ provider, cwd: wt.dir, tools: ["eslint"] });
      const verdict = await gate({ sessionId: "s", model: "Haiku 4.8", attempt: 0 });
      expect(verdict.failed).toBe(true);
      expect(verdict.diagnostics.length).toBeGreaterThan(0);
      expect(verdict.diagnostics.every((d) => d.severity === "error")).toBe(true);
      expect(verdict.diagnostics.some((d) => d.rule === "prefer-const")).toBe(true);
      expect(verdict.diagnostics.every((d) => d.tool === "eslint")).toBe(true);
    } finally {
      wt.cleanup();
    }
  }, 30_000);

  it("is GREEN on a clean worktree", async () => {
    const wt = makeCleanEslintFixture();
    try {
      const gate = realQualityGate({ provider, cwd: wt.dir, tools: ["eslint"] });
      const verdict = await gate({ sessionId: "s", model: "Haiku 4.8", attempt: 0 });
      expect(verdict.failed).toBe(false);
      expect(verdict.diagnostics).toEqual([]);
    } finally {
      wt.cleanup();
    }
  }, 30_000);

  it("is RED with the real tsc diagnostic on a type error", async () => {
    const wt = makeTscFixture();
    try {
      const gate = realQualityGate({ provider, cwd: wt.dir, tools: ["tsc"], options: { files: ["bad.ts"] } });
      const verdict = await gate({ sessionId: "s", model: "Haiku 4.8", attempt: 0 });
      expect(verdict.failed).toBe(true);
      expect(verdict.diagnostics.some((d) => d.tool === "tsc")).toBe(true);
    } finally {
      wt.cleanup();
    }
  }, 30_000);
});

describe("escalation driven by the REAL gate", () => {
  it("climbs to the ceiling on a red worktree, carrying the real eslint rule forward", async () => {
    const wt = makeEslintFixture();
    try {
      const { runSession, prompts } = stubRunner();
      const out = await runWithEscalation({
        router: new LiveModelRouter({ enabled: true }),
        origin: TODO,
        prompt: "Apply the mechanical fix",
        runSession,
        gate: realQualityGate({ provider, cwd: wt.dir, tools: ["eslint"] }),
      });

      // The worktree stays red every pass → small → mid → large, then stops.
      expect(out.attempts.map((a) => a.model)).toEqual(["Haiku 4.8", "Sonnet 4.8", "Opus 4.8"]);
      expect(out.escalated).toBe(true);
      // The re-spawn prompts carry the REAL grounded diagnostic (not a fake).
      expect(prompts[0]).not.toContain("prefer-const");
      expect(prompts[1]).toContain("prefer-const");
      expect(prompts[1]).toContain("eslint");
    } finally {
      wt.cleanup();
    }
  }, 60_000);

  it("does NOT escalate when the real gate is green", async () => {
    const wt = makeCleanEslintFixture();
    try {
      const { runSession } = stubRunner();
      const out = await runWithEscalation({
        router: new LiveModelRouter({ enabled: true }),
        origin: TODO,
        prompt: "Apply the mechanical fix",
        runSession,
        gate: realQualityGate({ provider, cwd: wt.dir, tools: ["eslint"] }),
      });
      expect(out.escalated).toBe(false);
      expect(out.attempts).toHaveLength(1);
      expect(out.model).toBe("Haiku 4.8");
    } finally {
      wt.cleanup();
    }
  }, 30_000);
});
