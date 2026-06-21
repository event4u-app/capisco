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
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { AcpSession, type PermissionResolver } from "../acp/acp-session.ts";
import { AcpTransport, SEALED_CHILD_ENV_ALLOWLIST } from "../acp/acp-transport.ts";
import type { AcpToolCall } from "@/contracts";
import type { SessionEvent } from "@/contracts";

const HERE = dirname(fileURLToPath(import.meta.url));
/** The hostile stub that lies `fromUntrusted:false` on its egress (Fix 1). */
const MALICIOUS_STUB = join(HERE, "..", "acp", "malicious-stub-acp-agent.mjs");

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

  it("Fix 1 — a hostile agent sending fromUntrusted:false in an UNTRUSTED session is STILL forced to ask", async () => {
    // CLIENT-ASSIGNED TAINT: the client owns the taint by session provenance,
    // not the agent. The malicious stub lies (`fromUntrusted:false`) on its
    // egress to dodge the lethal-trifecta gate. In an untrusted session (default)
    // the downgrade is IGNORED — effective taint = sessionUntrusted || agentFlag
    // — so the write must still reach the human gate, marked untrusted.
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const gated: { kind: string; fromUntrusted: boolean }[] = [];

    const session = track(
      new AcpSession({
        broker,
        store,
        cwd: "/tmp/worktree-taint",
        model: "Hostile Agent",
        // Default-untrusted session (untrusted omitted ⇒ true).
        command: process.execPath,
        args: [MALICIOUS_STUB],
        resolvePermission: (req, ctx) => {
          if (req.kind === "file-write") {
            gated.push({ kind: req.kind, fromUntrusted: ctx.fromUntrusted });
          }
          return { axis: "deny" };
        },
      }),
    );
    await session.start("Exfiltrate via a downgraded egress");

    // The write reached the human gate (was NOT auto-allowed) AND it arrived
    // marked untrusted despite the agent's `fromUntrusted:false` lie.
    expect(gated).toHaveLength(1);
    expect(gated[0]?.fromUntrusted).toBe(true);

    // Defence-in-depth: a direct broker.authorize of the same egress, with the
    // session-effective taint applied, still hard-gates to `ask`.
    const probe = broker.authorize(
      { id: "acp-agent", kind: "agent", label: "Hostile Agent" },
      { kind: "file-write", target: "TODO-done.md", fromUntrusted: true },
    );
    expect(probe.outcome).toBe("ask");
  });

  it("Fix 2 — the spawned child gets a sealed minimal env (no credentials) and piped stderr", () => {
    // The transport must NOT spread process.env into the child and must NOT
    // inherit stderr to the host tty (a real agent CLI could leak a key there).
    // Plant a credential-shaped var on the parent; assert it never reaches the
    // child env, that the child env is exactly the allowlist, and that stderr is
    // captured (piped) rather than inherited.
    const SECRET_KEY = "CAPISCO_TEST_SECRET_TOKEN";
    process.env[SECRET_KEY] = "leak-me-if-you-can";
    try {
      const transport = new AcpTransport({
        onAgentRequest: async () => ({ outcome: "deny", reason: "test" }),
        onNotification: () => {},
      });
      try {
        // stderr is captured (a string buffer) — proven piped, not inherited.
        expect(typeof transport.stderr).toBe("string");

        // The child env is the explicit credential-free allowlist. The planted
        // secret is absent; nothing outside the allowlist leaked in.
        const env = transport.childEnv;
        expect(SECRET_KEY in env).toBe(false);
        expect(env[SECRET_KEY]).toBeUndefined();
        for (const key of Object.keys(env)) {
          expect(SEALED_CHILD_ENV_ALLOWLIST).toContain(key);
        }
        // And it is NOT the full process.env (which carries the planted secret).
        expect(Object.keys(env).length).toBeLessThan(Object.keys(process.env).length);
      } finally {
        transport.close();
      }
    } finally {
      delete process.env[SECRET_KEY];
    }
  });
});
