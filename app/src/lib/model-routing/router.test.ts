/**
 * Deterministic model-router tests (Phase 4, token-economy / F5). The routing is
 * a PURE FUNCTION of session ORIGIN — so it is exhaustively unit-testable. The
 * acceptance:
 *  - route by ORIGIN, not content (mechanical → small, analysis → mid),
 *  - BLOCKLIST invariant: broker/permission, AI-review, untrusted-egress, and a
 *    reviewer subagent are NEVER downgraded (always large),
 *  - free conversation + architecture are NOT routed (default large),
 *  - small-first with QUALITY-DRIVEN escalation (B5 red → next tier up),
 *  - deterministic (same origin → same decision).
 */

import { describe, expect, it } from "vitest";
import {
  routeOrigin,
  escalate,
  escalateOnQuality,
  isBlocklisted,
  resolveModel,
  tierLessThan,
  DEFAULT_TIER,
} from "./router.ts";
import type { ModelTierMap, SessionOrigin } from "@/contracts";

const MAP: ModelTierMap = { small: "Haiku 4.8", mid: "Sonnet 4.8", large: "Opus 4.8" };

describe("routeOrigin — route by ORIGIN, not content", () => {
  it("routes mechanical roadmap steps to small", () => {
    const d = routeOrigin({ kind: "roadmap-step", stepCategory: "mechanical" });
    expect(d.tier).toBe("small");
    expect(d.reason).toBe("mechanical-small");
    expect(d.blocklisted).toBe(false);
  });

  it("routes test-writing + doc steps to small", () => {
    expect(routeOrigin({ kind: "roadmap-step", stepCategory: "test-writing" }).tier).toBe(
      "small",
    );
    expect(routeOrigin({ kind: "roadmap-step", stepCategory: "doc" }).tier).toBe("small");
  });

  it("routes analysis steps to mid (multi-file reasoning, not trivial)", () => {
    const d = routeOrigin({ kind: "roadmap-step", stepCategory: "analysis" });
    expect(d.tier).toBe("mid");
    expect(d.reason).toBe("analysis-mid");
  });

  it("does NOT downgrade a design-category step (judgement work)", () => {
    expect(routeOrigin({ kind: "roadmap-step", stepCategory: "design" }).tier).toBe("large");
  });

  it("routes ToDo + mechanical subagents to small", () => {
    expect(routeOrigin({ kind: "todo" }).tier).toBe("small");
    expect(routeOrigin({ kind: "subagent", subagentType: "test-writer" }).tier).toBe("small");
    expect(routeOrigin({ kind: "subagent", subagentType: "fixer" }).tier).toBe("small");
    expect(routeOrigin({ kind: "subagent", subagentType: "summarizer" }).tier).toBe("small");
    expect(routeOrigin({ kind: "subagent", subagentType: "searcher" }).tier).toBe("small");
  });

  it("does NOT route free conversation or architecture (default large)", () => {
    expect(routeOrigin({ kind: "free-conversation" }).tier).toBe(DEFAULT_TIER);
    expect(routeOrigin({ kind: "architecture" }).tier).toBe(DEFAULT_TIER);
    expect(routeOrigin({ kind: "free-conversation" }).reason).toBe("not-routed-default-tier");
  });
});

describe("BLOCKLIST invariant — never downgraded", () => {
  const blocked: SessionOrigin[] = [
    { kind: "broker-decision" },
    { kind: "ai-review" },
    { kind: "untrusted-egress" },
    { kind: "subagent", subagentType: "reviewer" },
  ];

  it("flags every blocklisted origin", () => {
    for (const o of blocked) expect(isBlocklisted(o)).toBe(true);
  });

  it("routes every blocklisted origin to large with the blocklist reason", () => {
    for (const o of blocked) {
      const d = routeOrigin(o);
      expect(d.tier).toBe("large");
      expect(d.blocklisted).toBe(true);
      expect(d.reason).toBe("blocklist-never-downgrade");
    }
  });

  it("does NOT flag a routable origin", () => {
    expect(isBlocklisted({ kind: "todo" })).toBe(false);
    expect(isBlocklisted({ kind: "subagent", subagentType: "fixer" })).toBe(false);
  });
});

describe("quality-driven escalation (B5 red → bigger model)", () => {
  it("escalate steps up one tier, capped at large", () => {
    expect(escalate("small")).toBe("mid");
    expect(escalate("mid")).toBe("large");
    expect(escalate("large")).toBe("large");
  });

  it("escalateOnQuality is a no-op when quality passed", () => {
    const d = routeOrigin({ kind: "todo" }); // small
    expect(escalateOnQuality(d, false)).toEqual(d);
  });

  it("escalateOnQuality steps up on a red gate, with the escalation reason", () => {
    const small = routeOrigin({ kind: "todo" }); // small
    const up1 = escalateOnQuality(small, true);
    expect(up1.tier).toBe("mid");
    expect(up1.reason).toBe("escalated-on-quality");
    const up2 = escalateOnQuality(up1, true);
    expect(up2.tier).toBe("large");
    // A third red does not exceed large.
    expect(escalateOnQuality(up2, true).tier).toBe("large");
  });

  it("escalation never downgrades and keeps the blocklist flag", () => {
    const blocked = routeOrigin({ kind: "ai-review" }); // large, blocklisted
    const after = escalateOnQuality(blocked, true);
    expect(after.tier).toBe("large");
    expect(after.blocklisted).toBe(true);
  });
});

describe("tier → model resolution + ordering", () => {
  it("resolves a tier to the configured model id", () => {
    expect(resolveModel("small", MAP)).toBe("Haiku 4.8");
    expect(resolveModel("mid", MAP)).toBe("Sonnet 4.8");
    expect(resolveModel("large", MAP)).toBe("Opus 4.8");
  });

  it("orders tiers small < mid < large", () => {
    expect(tierLessThan("small", "mid")).toBe(true);
    expect(tierLessThan("mid", "large")).toBe(true);
    expect(tierLessThan("large", "small")).toBe(false);
  });
});

describe("determinism", () => {
  it("same origin → same decision (pure function)", () => {
    const o: SessionOrigin = { kind: "roadmap-step", stepCategory: "mechanical" };
    expect(routeOrigin(o)).toEqual(routeOrigin(o));
  });
});
