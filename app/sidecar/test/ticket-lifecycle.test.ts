/**
 * B6 Phase 1 — one-direction ticket lifecycle (concept §4.5/§7 north-star),
 * end-to-end against the REAL primitives: a temp git repo (real worktree, B2),
 * the real in-memory session store (B3), and the real capability broker (B4).
 *
 * The load-bearing security property: the ticket status write-back is an
 * `external-write` derived from UNTRUSTED ticket data, so it is a hard broker
 * gate and can NEVER auto-fire (MUST-NOT 4 / lethal trifecta). These tests prove:
 *  - the local worktree + session come up regardless of the status gate;
 *  - by default (fail-closed) the external status write is GATED, never written;
 *  - the broker audits the untrusted-egress gate BEFORE any execution;
 *  - only an explicit per-call human `session` decision yields `written` and
 *    fires the external PATCH — executed as the `human` principal;
 *  - a `once` decision cannot be executed (documented B4 limit) → stays gated.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { RealWorktreeProvider } from "../git/real-worktree-provider.ts";
import { FixtureTaskProvider } from "../task-forge/fixture-task-provider.ts";
import { TicketLifecycleImpl } from "../task-forge/ticket-lifecycle.ts";
import type { StatusWriteResolver } from "../task-forge/ticket-lifecycle.ts";
import { loadTaskFixture } from "../task-forge/load-fixtures.ts";
import { makeTempRepo, type TempRepo } from "./git-temp-repo.ts";
import { join } from "node:path";

let repo: TempRepo;

function makeLifecycle(opts: {
  resolveStatusWrite?: StatusWriteResolver;
  performStatusWrite?: (i: { ticketId: string; targetStatus: string }) => void;
  store?: InMemorySessionStore;
  broker?: Broker;
}) {
  const task = new FixtureTaskProvider(loadTaskFixture("jira"));
  const worktree = new RealWorktreeProvider();
  const store = opts.store ?? new InMemorySessionStore();
  const broker = opts.broker ?? new Broker({});
  const lifecycle = new TicketLifecycleImpl({
    task,
    worktree,
    store,
    broker,
    repoCwd: repo.dir,
    worktreePath: (id) => join(repo.dir, ".worktrees", id),
    resolveStatusWrite: opts.resolveStatusWrite,
    performStatusWrite: opts.performStatusWrite as never,
  });
  return { task, worktree, store, broker, lifecycle };
}

beforeEach(() => {
  repo = makeTempRepo();
  repo.write("README.md", "# fixture repo\n");
  repo.commitAll("init");
});

afterEach(() => {
  repo.cleanup();
});

describe("ticket lifecycle — local primitives come up", () => {
  it("startTicket creates a worktree coupled to a session and moves status to progress", async () => {
    const { lifecycle, worktree } = makeLifecycle({});
    const result = await lifecycle.startTicket("CAP-155");

    expect(result.ticket.id).toBe("CAP-155");
    expect(result.sessionId).toBeTruthy();
    expect(result.targetStatus).toBe("progress");
    // The real worktree exists on disk, on its ticket branch, coupled to the session.
    const list = await worktree.list(repo.dir);
    const made = list.find((w) => w.branch === "ticket/CAP-155");
    expect(made).toBeDefined();
    expect(made?.sessionId).toBe(result.sessionId);
  });

  it("the session record is coupled to the worktree path (§2.1)", async () => {
    const { lifecycle, store } = makeLifecycle({});
    const result = await lifecycle.startTicket("CAP-155");
    const stored = await store.get(result.sessionId);
    expect(stored?.worktreePath).toContain(".worktrees");
    expect(stored?.status).toBe("running");
  });

  it("throws for an unknown ticket", async () => {
    const { lifecycle } = makeLifecycle({});
    await expect(lifecycle.startTicket("CAP-000")).rejects.toThrow(/unknown ticket/);
  });
});

describe("ticket lifecycle — the external status write is a HARD untrusted-egress gate", () => {
  it("by default (fail-closed) the status write is GATED, never auto-fired", async () => {
    let fired = false;
    const { lifecycle } = makeLifecycle({
      performStatusWrite: () => {
        fired = true;
      },
    });
    const result = await lifecycle.startTicket("CAP-155");
    expect(result.statusWrite).toBe("gated");
    expect(fired).toBe(false); // the external PATCH never ran
  });

  it("the broker audits the untrusted-egress ASK before any execution", async () => {
    const { lifecycle, broker } = makeLifecycle({});
    await lifecycle.startTicket("CAP-155");
    const audit = broker.audit.list();
    const gate = audit.find(
      (e) => e.capability === "external-write" && e.fromUntrusted && e.outcome === "ask",
    );
    expect(gate).toBeDefined();
    expect(gate?.principalKind).toBe("agent"); // authored by the automation, not a human
    expect(gate?.target).toContain("ticket:CAP-155:status=progress");
    // No secret value ever in the audit target.
    expect(gate?.target).not.toMatch(/token|password|=.*secret/i);
    // And NO `executed` record exists (nothing ran).
    expect(audit.some((e) => e.outcome === "executed")).toBe(false);
  });

  it("an explicit per-call human SESSION decision writes the status (laundered as human)", async () => {
    let fired: { ticketId: string; targetStatus: string } | null = null;
    const resolveStatusWrite: StatusWriteResolver = () => ({ axis: "session" });
    const { lifecycle, broker } = makeLifecycle({
      resolveStatusWrite,
      performStatusWrite: (i) => {
        fired = i as never;
      },
    });
    const result = await lifecycle.startTicket("CAP-155");
    expect(result.statusWrite).toBe("written");
    expect(fired!).toEqual({ ticketId: "CAP-155", targetStatus: "progress" });
    // The execution was recorded as the HUMAN principal over a trusted request.
    const exec = broker.audit.list().find((e) => e.outcome === "executed");
    expect(exec).toBeDefined();
    expect(exec?.principalKind).toBe("human");
    expect(exec?.fromUntrusted).toBe(false);
  });

  it("a human DENY leaves the status gated", async () => {
    const { lifecycle } = makeLifecycle({ resolveStatusWrite: () => ({ axis: "deny" }) });
    const result = await lifecycle.startTicket("CAP-155");
    expect(result.statusWrite).toBe("gated");
  });

  it("a human ONCE decision cannot be executed (B4 limit) → stays gated", async () => {
    let fired = false;
    const { lifecycle } = makeLifecycle({
      resolveStatusWrite: () => ({ axis: "once" }),
      performStatusWrite: () => {
        fired = true;
      },
    });
    const result = await lifecycle.startTicket("CAP-155");
    // `once` is not persisted → broker.execute re-decides to `ask` → throws →
    // caught → gated. The external PATCH never runs.
    expect(result.statusWrite).toBe("gated");
    expect(fired).toBe(false);
  });
});

describe("ticket lifecycle — finish (one direction → In Review)", () => {
  it("finishTicket marks the session done and moves status to review (gated by default)", async () => {
    const store = new InMemorySessionStore();
    const { lifecycle } = makeLifecycle({ store });
    const start = await lifecycle.startTicket("CAP-155");
    const finish = await lifecycle.finishTicket("CAP-155", start.sessionId);
    expect(finish.targetStatus).toBe("review");
    expect(finish.statusWrite).toBe("gated");
    expect((await store.get(start.sessionId))?.status).toBe("done");
  });

  it("finish writes the review status when a human clears it", async () => {
    const fired: string[] = [];
    const { lifecycle } = makeLifecycle({
      resolveStatusWrite: () => ({ axis: "session" }),
      performStatusWrite: (i) => fired.push(i.targetStatus),
    });
    const start = await lifecycle.startTicket("CAP-155");
    const finish = await lifecycle.finishTicket("CAP-155", start.sessionId);
    expect(finish.statusWrite).toBe("written");
    expect(fired).toEqual(["progress", "review"]);
  });
});
