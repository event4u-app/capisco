/**
 * Quality-driven escalation tests (road-to-model-routing P1). Proves SMALL-FIRST
 * with escalation on a FORCED-RED quality verdict — WITHOUT a real LLM or a real
 * (paid) escalation: the run is the deterministic broker-gated stub session, the
 * verdict is a fake RED/GREEN. Asserts:
 *   - GREEN small-first → NO escalation (one attempt, stays at the small model).
 *   - RED small-first → escalates to the next tier, carrying the ERRORS forward.
 *   - keeps escalating until GREEN or the `large` ceiling.
 *   - the double-run cost is VISIBLE (every attempt listed, `escalated` flag).
 *   - a BLOCKLISTED origin starts large → escalation is a structural no-op.
 */

import { describe, expect, it } from "vitest";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { createAcpTodoStarter } from "../todo/acp-todo-starter.ts";
import { LiveModelRouter } from "../model-routing/live-router.ts";
import {
  runWithEscalation,
  buildEscalationPrompt,
  verdictFromResults,
  type QualityGate,
  type RunSession,
} from "../model-routing/escalation.ts";
import type { Diagnostic, SessionOrigin } from "@/contracts";
import type { PermissionResolver } from "../acp/acp-session.ts";

const ALLOW_ALL: PermissionResolver = () => ({ axis: "session" });

const TSC_ERROR: Diagnostic = {
  tool: "tsc",
  file: "src/x.ts",
  line: 12,
  severity: "error",
  rule: "TS2322",
  message: "Type 'string' is not assignable to type 'number'.",
};

/** A real broker-gated stub run as the {@link RunSession} seam (no LLM). Records
 * the prompt each attempt received so we can assert the errors were carried. */
function stubRunner(): { runSession: RunSession; prompts: string[] } {
  const broker = new Broker();
  const store = new InMemorySessionStore();
  const starter = createAcpTodoStarter({ broker, store, resolvePermission: ALLOW_ALL });
  const prompts: string[] = [];
  const runSession: RunSession = async ({ prompt }) => {
    prompts.push(prompt);
    return starter(prompt, "/repo/.worktrees/current");
  };
  return { runSession, prompts };
}

/** A FAKE quality gate that is RED for the first `redPasses` attempts, then GREEN.
 * The deterministic signal — no real tool run, no real LLM. */
function fakeGate(redPasses: number): QualityGate {
  return ({ attempt }) =>
    attempt < redPasses
      ? { failed: true, diagnostics: [TSC_ERROR] }
      : { failed: false, diagnostics: [] };
}

const TODO: SessionOrigin = { kind: "todo" };

describe("escalation — GREEN small-first does NOT escalate", () => {
  it("one attempt, stays at the small model, escalated=false", async () => {
    const { runSession } = stubRunner();
    const out = await runWithEscalation({
      router: new LiveModelRouter({ enabled: true }),
      origin: TODO,
      prompt: "Apply the rector fix",
      runSession,
      gate: fakeGate(0), // green from the start
    });
    expect(out.escalated).toBe(false);
    expect(out.attempts).toHaveLength(1);
    expect(out.model).toBe("Haiku 4.8"); // small
    expect(out.decision.reason).toBe("mechanical-small");
  });
});

describe("escalation — RED small-first escalates carrying the errors", () => {
  it("steps small → mid on one red, with the errors in the re-spawn prompt", async () => {
    const { runSession, prompts } = stubRunner();
    const out = await runWithEscalation({
      router: new LiveModelRouter({ enabled: true }),
      origin: TODO,
      prompt: "Apply the rector fix",
      runSession,
      gate: fakeGate(1), // first pass red, then green
    });
    expect(out.escalated).toBe(true);
    expect(out.attempts).toHaveLength(2);
    // small first, then mid.
    expect(out.attempts[0].model).toBe("Haiku 4.8");
    expect(out.attempts[1].model).toBe("Sonnet 4.8");
    expect(out.model).toBe("Sonnet 4.8");
    expect(out.decision.reason).toBe("escalated-on-quality");
    // The escalated pass carried the FAILING ERROR as context.
    expect(prompts).toHaveLength(2);
    expect(prompts[0]).not.toContain("TS2322");
    expect(prompts[1]).toContain("TS2322");
    expect(prompts[1]).toContain("src/x.ts:12");
  });

  it("keeps escalating small → mid → large while red, capped at large", async () => {
    const { runSession } = stubRunner();
    const out = await runWithEscalation({
      router: new LiveModelRouter({ enabled: true }),
      origin: TODO,
      prompt: "Apply the rector fix",
      runSession,
      gate: fakeGate(99), // always red
    });
    // small, mid, large — then stops at the ceiling (no infinite spin).
    expect(out.attempts.map((a) => a.model)).toEqual(["Haiku 4.8", "Sonnet 4.8", "Opus 4.8"]);
    expect(out.model).toBe("Opus 4.8");
    expect(out.escalated).toBe(true);
  });
});

describe("escalation — double-run cost is transparent", () => {
  it("every attempt is listed with its tier, model, and verdict", async () => {
    const { runSession } = stubRunner();
    const out = await runWithEscalation({
      router: new LiveModelRouter({ enabled: true }),
      origin: TODO,
      prompt: "x",
      runSession,
      gate: fakeGate(1),
    });
    expect(out.attempts.map((a) => ({ tier: a.decision.tier, failed: a.verdict.failed }))).toEqual([
      { tier: "small", failed: true },
      { tier: "mid", failed: false },
    ]);
    // The small attempt is paid ON TOP — both sessions exist (visible cost).
    expect(new Set(out.attempts.map((a) => a.sessionId)).size).toBe(2);
  });
});

describe("escalation — blocklist origin starts large (no-op escalation)", () => {
  it("an ai-review origin runs once at large even on a red gate", async () => {
    const { runSession } = stubRunner();
    const out = await runWithEscalation({
      router: new LiveModelRouter({ enabled: true }),
      origin: { kind: "ai-review" },
      prompt: "review this",
      runSession,
      gate: fakeGate(99), // red — but there is nowhere above large to go
    });
    expect(out.attempts).toHaveLength(1);
    expect(out.model).toBe("Opus 4.8");
    expect(out.escalated).toBe(false);
    expect(out.decision.blocklisted).toBe(true);
  });
});

describe("escalation — pure helpers", () => {
  it("buildEscalationPrompt appends grounded errors, no-ops on none", () => {
    expect(buildEscalationPrompt("p", [])).toBe("p");
    const withErr = buildEscalationPrompt("p", [TSC_ERROR]);
    expect(withErr).toContain("quality gate failed");
    expect(withErr).toContain("TS2322");
  });

  it("verdictFromResults maps real-runner results to red/green + error diagnostics", () => {
    const red = verdictFromResults([{ ok: false, diagnostics: [TSC_ERROR] }]);
    expect(red.failed).toBe(true);
    expect(red.diagnostics).toEqual([TSC_ERROR]);
    const green = verdictFromResults([{ ok: true, diagnostics: [] }]);
    expect(green.failed).toBe(false);
  });
});
