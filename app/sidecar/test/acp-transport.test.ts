/**
 * ACP transport + broker-seam integration test (B3 Phase 1). Drives the real
 * child-process stub agent (`stub-acp-agent.mjs`) over JSON-RPC/NDJSON stdio and
 * proves:
 *
 *  - the transport round-trips (`session/new` + `session/prompt`),
 *  - agent `session/update` events stream into the session-tree + subscribers,
 *  - EVERY agent tool action passes through the broker (B4) — the stub cannot
 *    act around it: an allow runs the side effect inside `broker.execute`, a deny
 *    blocks it, and the append-only audit records every authorization.
 *
 * No LLM key, no real agent — the stub is deterministic, so the test is
 * reproducible. The stub never touches fs/shell/net itself; the only "action"
 * path is `session/request_permission` → this client's broker gate.
 */

import { afterEach, describe, expect, it } from "vitest";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { AcpSession, type PermissionResolver } from "../acp/acp-session.ts";
import type { AcpToolCall } from "@/contracts";
import type { SessionEvent } from "@/contracts";

// A human who clears every gate for the run. `session` persists the grant on
// the trusted (human-reviewed) shape so the broker's execute re-decide allows
// the single action (`once` is single-shot and the broker cannot execute it —
// a documented B4 limitation; `session` is the natural "yes for this run").
const ALLOW_ALL: PermissionResolver = () => ({ axis: "session" });
const DENY_ALL: PermissionResolver = () => ({ axis: "deny" });

const sessions: AcpSession[] = [];
function track(s: AcpSession): AcpSession {
  sessions.push(s);
  return s;
}

afterEach(() => {
  for (const s of sessions.splice(0)) s.close();
});

describe("ACP transport ↔ stub agent ↔ broker", () => {
  it("round-trips a prompt and streams events into the session tree", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const events: SessionEvent[] = [];
    const performed: string[] = [];

    const session = track(
      new AcpSession({
        broker,
        store,
        cwd: "/tmp/worktree-x",
        model: "Stub Agent",
        resolvePermission: ALLOW_ALL,
        perform: (call: AcpToolCall) => performed.push(`${call.kind}:${call.target}`),
      }),
    );
    session.subscribe((e) => events.push(e));

    const sessionId = await session.start("Implement the worktree teardown");

    // The stream reached `done`.
    expect(events.some((e) => e.type === "done")).toBe(true);
    expect(events.some((e) => e.type === "token")).toBe(true);

    // Events persisted: the session is coupled to its worktree (§2.1), status done.
    const stored = await store.get(sessionId);
    expect(stored?.worktreePath).toBe("/tmp/worktree-x");
    expect(stored?.status).toBe("done");
    expect(stored?.telemetry).toEqual({ tokensIn: 42, tokensOut: 128, runtimeMs: 1000 });

    // The tool actions landed in the session tree (the transcript).
    const resumed = await store.resume(sessionId);
    const toolTargets = resumed.blocks
      .filter((b) => b.type === "tool")
      .map((b) => b.block.target);
    expect(toolTargets).toContain("README.md");
    expect(toolTargets).toContain("TODO-done.md");

    // Both actions ran THROUGH the broker (the client performed them, not the stub).
    expect(performed).toEqual(["file-read:README.md", "file-write:TODO-done.md"]);
  });

  it("the broker is un-bypassable: a deny blocks the agent's write", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const performed: string[] = [];

    // file-read is allowlisted (allow), but the write asks → DENY_ALL blocks it.
    const session = track(
      new AcpSession({
        broker,
        store,
        cwd: "/tmp/worktree-y",
        model: "Stub Agent",
        resolvePermission: DENY_ALL,
        perform: (call) => performed.push(`${call.kind}:${call.target}`),
      }),
    );

    const sessionId = await session.start("Try to write a file");

    // The read (allowlisted) ran; the write (asked → denied) did NOT.
    expect(performed).toEqual(["file-read:README.md"]);

    const resumed = await store.resume(sessionId);
    const kinds = resumed.blocks
      .filter((b) => b.type === "tool")
      .map((b) => b.block.kind);
    // The stub reports the blocked write as a "(blocked)" tool record.
    expect(kinds).toContain("Edit (blocked)");
    expect(kinds).not.toContain("Edit");
  });

  it("writes an append-only audit BEFORE execution for every gated action", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();

    const session = track(
      new AcpSession({
        broker,
        store,
        cwd: "/tmp/worktree-z",
        model: "Stub Agent",
        resolvePermission: ALLOW_ALL,
      }),
    );
    await session.start("Audit me");

    const audit = broker.audit.list();
    // At minimum: authorize(file-read) + executed(file-read) + authorize(file-write)
    // + executed(file-write). The audit is monotonic and append-only.
    const outcomes = audit.map((a) => `${a.capability}:${a.outcome}`);
    expect(outcomes).toContain("file-read:allow");
    expect(outcomes).toContain("file-read:executed");
    expect(outcomes).toContain("file-write:executed");
    // Monotonic sequence, never wall-clock.
    const seqs = audit.map((a) => a.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
  });

  it("the untrusted write is a HARD gate — it reaches `ask`, never auto-allows", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const gatedCalls: { fromUntrusted: boolean }[] = [];

    const session = track(
      new AcpSession({
        broker,
        store,
        cwd: "/tmp/worktree-trifecta",
        model: "Stub Agent",
        resolvePermission: (_req, ctx) => {
          gatedCalls.push({ fromUntrusted: ctx.fromUntrusted });
          return { axis: "deny" };
        },
      }),
    );
    await session.start("Lethal trifecta");

    // The write (fromUntrusted) reached the human gate; it was never auto-fired.
    expect(gatedCalls.some((c) => c.fromUntrusted)).toBe(true);
  });

  it("approving an untrusted egress with `session` does NOT persist a grant (per-call only)", async () => {
    // §3.3 — the human approves the stub's untrusted file-write with axis
    // `session`; the single approved write must EXECUTE, but it must NOT
    // launder into a standing session/scoped grant for that kind/scope.
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const performed: string[] = [];

    const session = track(
      new AcpSession({
        broker,
        store,
        cwd: "/tmp/worktree-no-launder",
        model: "Stub Agent",
        resolvePermission: ALLOW_ALL, // axis: "session"
        perform: (call: AcpToolCall) => performed.push(`${call.kind}:${call.target}`),
      }),
    );
    await session.start("Approve the untrusted write once");

    // The single approved (untrusted) write executed exactly once.
    expect(performed).toEqual(["file-read:README.md", "file-write:TODO-done.md"]);

    // No standing grant was laundered: a SECOND untrusted egress of the same
    // kind/scope still hard-gates to `ask`.
    const secondUntrusted = broker.authorize(
      { id: "acp-agent", kind: "agent", label: "Stub Agent" },
      { kind: "file-write", target: "TODO-done.md", fromUntrusted: true },
    );
    expect(secondUntrusted.outcome).toBe("ask");

    // And a TRUSTED egress of the same kind/scope is NOT pre-cleared by the
    // untrusted approval — the single-use grant was consumed by the one
    // approved call, so this still asks.
    const trusted = broker.authorize(
      { id: "you", kind: "human", label: "You" },
      { kind: "file-write", target: "TODO-done.md" },
    );
    expect(trusted.outcome).toBe("ask");
  });

  it("a `session` grant for the write can NOT pre-clear a future untrusted egress", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();

    // Pre-grant file-write `session` (a normal, trusted grant).
    broker.resolve(
      { id: "you", kind: "human", label: "You" },
      { kind: "file-write", target: "TODO-done.md" },
      { axis: "session" },
    );

    const blocked: boolean[] = [];
    const session = track(
      new AcpSession({
        broker,
        store,
        cwd: "/tmp/worktree-trifecta-2",
        model: "Stub Agent",
        resolvePermission: (_req, ctx) => {
          // The untrusted write STILL reaches here despite the session grant.
          blocked.push(ctx.fromUntrusted);
          return { axis: "deny" };
        },
      }),
    );
    await session.start("Untrusted egress under a session grant");

    // The untrusted write was NOT pre-cleared by the session grant — it hit the gate.
    expect(blocked).toContain(true);
  });
});
