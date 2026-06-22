/**
 * LiveModelRouter tests (road-to-model-routing P0) — the LIVE composition of the
 * pure origin-router with the on/off toggle and the runtime blocklist invariant.
 *
 * The pure routing functions are exhaustively covered in
 * `src/lib/model-routing/router.test.ts`. THIS suite proves the two stateful
 * concerns the spawn path adds:
 *   - DEFAULT OFF — a fresh router does not route (everything stays large).
 *   - Toggle ON — origin decides the tier (mechanical → small, analysis → mid).
 *   - BLOCKLIST as a RUNTIME INVARIANT — broker/review/untrusted-egress are large
 *     INDEPENDENT of the toggle (the negative-assert: routing ON still yields large).
 *   - Determinism — same origin → same model.
 */

import { describe, expect, it } from "vitest";
import { LiveModelRouter, DEFAULT_TIER_MAP } from "../model-routing/live-router.ts";
import type { SessionOrigin } from "@/contracts";

describe("LiveModelRouter — default OFF (the Decision-Gate lock)", () => {
  it("does not route by default: a mechanical origin stays large", () => {
    const router = new LiveModelRouter(); // no opts → off
    expect(router.enabled).toBe(false);
    const r = router.resolveSpawn({ kind: "todo" });
    expect(r.model).toBe("Opus 4.8"); // large
    expect(r.decision.tier).toBe("large");
    expect(r.decision.reason).toBe("not-routed-default-tier");
    expect(r.routingEnabled).toBe(false);
  });

  it("treats an explicit enabled:false the same as default-off", () => {
    const router = new LiveModelRouter({ enabled: false });
    expect(router.resolveSpawn({ kind: "roadmap-step", stepCategory: "mechanical" }).model).toBe(
      "Opus 4.8",
    );
  });
});

describe("LiveModelRouter — toggle ON routes by origin", () => {
  const router = new LiveModelRouter({ enabled: true });

  it("routes mechanical roadmap steps + ToDo + mechanical subagents to small", () => {
    expect(router.resolveSpawn({ kind: "roadmap-step", stepCategory: "mechanical" }).model).toBe(
      "Haiku 4.8",
    );
    expect(router.resolveSpawn({ kind: "todo" }).model).toBe("Haiku 4.8");
    expect(router.resolveSpawn({ kind: "subagent", subagentType: "test-writer" }).model).toBe(
      "Haiku 4.8",
    );
  });

  it("routes analysis steps to mid", () => {
    const r = router.resolveSpawn({ kind: "roadmap-step", stepCategory: "analysis" });
    expect(r.model).toBe("Sonnet 4.8");
    expect(r.decision.tier).toBe("mid");
  });

  it("does NOT route free conversation or architecture (stays large)", () => {
    expect(router.resolveSpawn({ kind: "free-conversation" }).model).toBe("Opus 4.8");
    expect(router.resolveSpawn({ kind: "architecture" }).model).toBe("Opus 4.8");
  });
});

describe("BLOCKLIST as a RUNTIME INVARIANT — never downgraded, on OR off", () => {
  const blocked: SessionOrigin[] = [
    { kind: "broker-decision" },
    { kind: "ai-review" },
    { kind: "untrusted-egress" },
    { kind: "subagent", subagentType: "reviewer" },
  ];

  it("with routing OFF, every blocklisted surface is large + flagged", () => {
    const off = new LiveModelRouter({ enabled: false });
    for (const o of blocked) {
      const r = off.resolveSpawn(o);
      expect(r.model).toBe("Opus 4.8");
      expect(r.decision.blocklisted).toBe(true);
      expect(r.decision.reason).toBe("blocklist-never-downgrade");
    }
  });

  it("NEGATIVE-ASSERT: with routing ON, every blocklisted surface STILL gets large", () => {
    const on = new LiveModelRouter({ enabled: true });
    for (const o of blocked) {
      const r = on.resolveSpawn(o);
      expect(r.model).toBe("Opus 4.8");
      expect(r.decision.tier).toBe("large");
      expect(r.decision.blocklisted).toBe(true);
    }
  });

  it("the toggle cannot reach the blocklist (flipping on/off never downgrades it)", () => {
    const router = new LiveModelRouter({ enabled: false });
    const review: SessionOrigin = { kind: "ai-review" };
    expect(router.resolveSpawn(review).model).toBe("Opus 4.8");
    router.setEnabled(true);
    expect(router.resolveSpawn(review).model).toBe("Opus 4.8");
    router.setEnabled(false);
    expect(router.resolveSpawn(review).model).toBe("Opus 4.8");
  });
});

describe("LiveModelRouter — determinism + config", () => {
  it("same origin → same model (pure, repeatable)", () => {
    const router = new LiveModelRouter({ enabled: true });
    const o: SessionOrigin = { kind: "roadmap-step", stepCategory: "mechanical" };
    expect(router.resolveSpawn(o)).toEqual(router.resolveSpawn(o));
  });

  it("honours a custom tier→model binding", () => {
    const router = new LiveModelRouter({
      enabled: true,
      tierMap: { small: "tiny", mid: "medium", large: "huge" },
    });
    expect(router.resolveSpawn({ kind: "todo" }).model).toBe("tiny");
    expect(router.resolveSpawn({ kind: "free-conversation" }).model).toBe("huge");
  });

  it("exposes the default tier map labels the composer uses", () => {
    expect(DEFAULT_TIER_MAP).toEqual({
      small: "Haiku 4.8",
      mid: "Sonnet 4.8",
      large: "Opus 4.8",
    });
  });
});
