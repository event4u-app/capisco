/**
 * LIVE origin-routing in the spawn path (road-to-model-routing P0). Proves the
 * router is wired into the real broker-gated ToDo→agent spawn (the stub agent,
 * no LLM): the STORED session's model is the router's deterministic decision for
 * the run's ORIGIN — small when routing is on for a mechanical ToDo, large when
 * off, and large for a blocklisted origin EVEN with routing on (the runtime
 * invariant, exercised through the real spawn, not just the pure predicate).
 */

import { describe, expect, it } from "vitest";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { TodoProviderImpl } from "../todo/todo-provider.ts";
import { createAcpTodoStarter } from "../todo/acp-todo-starter.ts";
import { LiveModelRouter } from "../model-routing/live-router.ts";
import { parseTodos } from "@/lib/todo/todo-parser.ts";
import type { PermissionResolver } from "../acp/acp-session.ts";
import type { SessionOrigin } from "@/contracts";

const ALLOW_ALL: PermissionResolver = () => ({ axis: "session" });
const MARKDOWN = "- [ ] Apply the rector fix\n";

/** Spawn a ToDo run through the real broker-gated stub session with a given
 * router + origin, and return the stored session model the run was spawned at. */
async function spawnAndReadModel(router: LiveModelRouter, origin?: SessionOrigin): Promise<string> {
  const broker = new Broker();
  const store = new InMemorySessionStore();
  const starter = createAcpTodoStarter({ broker, store, router, origin, resolvePermission: ALLOW_ALL });
  const todo = new TodoProviderImpl(store, starter);
  const [item] = parseTodos("notes.md", MARKDOWN);
  const sessionId = await todo.sendToAgent(item, "/repo/.worktrees/current");
  const stored = await store.get(sessionId);
  return stored!.model;
}

describe("live origin-routing — spawn path (broker-gated stub, no LLM)", () => {
  it("routing OFF (default): a mechanical ToDo run spawns at the large model", async () => {
    const model = await spawnAndReadModel(new LiveModelRouter()); // default off
    expect(model).toBe("Opus 4.8");
  });

  it("routing ON: a mechanical ToDo run spawns at the small model (origin-routed)", async () => {
    const model = await spawnAndReadModel(new LiveModelRouter({ enabled: true }), { kind: "todo" });
    expect(model).toBe("Haiku 4.8");
  });

  it("routing ON: an analysis-step run spawns at the mid model", async () => {
    const model = await spawnAndReadModel(new LiveModelRouter({ enabled: true }), {
      kind: "roadmap-step",
      stepCategory: "analysis",
    });
    expect(model).toBe("Sonnet 4.8");
  });

  it("NEGATIVE-ASSERT: routing ON, a blocklisted (ai-review) origin STILL spawns large", async () => {
    const model = await spawnAndReadModel(new LiveModelRouter({ enabled: true }), {
      kind: "ai-review",
    });
    expect(model).toBe("Opus 4.8");
  });

  describe("blocklist invariant through the REAL spawn path (P2)", () => {
    // Every never-downgrade origin: a broker/permission decision, the AI-review
    // itself, an untrusted-egress surface, and a `reviewer` subagent. A weaker
    // model making any of these calls is a SECURITY downgrade — the invariant is
    // structural, exercised here through the actual broker-gated stub spawn (the
    // stored session model), not just the pure predicate.
    const blocked: { name: string; origin: SessionOrigin }[] = [
      { name: "broker-decision", origin: { kind: "broker-decision" } },
      { name: "ai-review", origin: { kind: "ai-review" } },
      { name: "untrusted-egress", origin: { kind: "untrusted-egress" } },
      { name: "reviewer subagent", origin: { kind: "subagent", subagentType: "reviewer" } },
    ];

    for (const { name, origin } of blocked) {
      it(`NEGATIVE-ASSERT: routing ON, a ${name} origin STILL spawns large`, async () => {
        const model = await spawnAndReadModel(new LiveModelRouter({ enabled: true }), origin);
        expect(model).toBe("Opus 4.8");
      });

      it(`routing OFF, a ${name} origin spawns large (invariant holds both ways)`, async () => {
        const model = await spawnAndReadModel(new LiveModelRouter({ enabled: false }), origin);
        expect(model).toBe("Opus 4.8");
      });
    }

    it("the toggle cannot reach the blocklist across spawns (flip on→off→on, never downgraded)", async () => {
      const router = new LiveModelRouter({ enabled: false });
      const review: SessionOrigin = { kind: "ai-review" };
      expect(await spawnAndReadModel(router, review)).toBe("Opus 4.8");
      router.setEnabled(true);
      expect(await spawnAndReadModel(router, review)).toBe("Opus 4.8");
      router.setEnabled(false);
      expect(await spawnAndReadModel(router, review)).toBe("Opus 4.8");
    });

    it("contrast: with the SAME router ON, a mechanical ToDo IS downgraded (proves routing is live)", async () => {
      // This is the control: the invariant is not "nothing ever routes" — a
      // mechanical origin on the same enabled router routes small, so the
      // blocklist large above is the invariant doing its job, not routing being off.
      const router = new LiveModelRouter({ enabled: true });
      expect(await spawnAndReadModel(router, { kind: "ai-review" })).toBe("Opus 4.8");
      expect(await spawnAndReadModel(router, { kind: "todo" })).toBe("Haiku 4.8");
    });
  });

  it("an explicit model override beats the router (the human/test always wins)", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const starter = createAcpTodoStarter({
      broker,
      store,
      router: new LiveModelRouter({ enabled: true }),
      model: "Forced Model",
      resolvePermission: ALLOW_ALL,
    });
    const todo = new TodoProviderImpl(store, starter);
    const [item] = parseTodos("notes.md", MARKDOWN);
    const sessionId = await todo.sendToAgent(item, "/repo/.worktrees/current");
    expect((await store.get(sessionId))!.model).toBe("Forced Model");
  });

  it("determinism: the same origin spawns the same model across runs", async () => {
    const a = await spawnAndReadModel(new LiveModelRouter({ enabled: true }), { kind: "todo" });
    const b = await spawnAndReadModel(new LiveModelRouter({ enabled: true }), { kind: "todo" });
    expect(a).toBe(b);
  });
});
