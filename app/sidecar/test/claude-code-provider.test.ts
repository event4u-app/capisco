// @vitest-environment node
/**
 * Native Claude-Code adapter test (B8 Phase 2a). Proves the stream-json backend
 * end-to-end WITHOUT invoking the real, paid `claude` (a real run is the user's
 * broker-approved go, DEFERRED). The "real CLI" here is
 * `node stream-json-fixture-agent.mjs` — a real child process that replays the
 * COMMITTED stream-json fixture over the exact protocol the real CLI uses, so the
 * full spine (sealed spawn → stdout decode → pure parser → broker seam → store)
 * is exercised deterministically.
 *
 * Mirrors `real-acp-adapter.test.ts` and the broker invariants:
 *  - The run streams the deterministic events and ends `done`.
 *  - EVERY tool the model requested went through the broker (audited).
 *  - A cleared gate executes the side effect; a DENIED gate performs NOTHING and
 *    writes NO `executed` audit (denied capability ⇒ no side effect).
 *  - SEALED SUBPROCESS: the child env is the credential-free allowlist, stderr is
 *    captured (never inherited) — no key in env/argv (native path uses the
 *    existing `claude` login, no raw key at all).
 *  - CLIENT-ASSIGNED TAINT: the session is untrusted by provenance; the
 *    model-derived egress (the Edit) is forced through the lethal-trifecta gate.
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import {
  ClaudeCodeProvider,
  type PermissionResolver,
} from "../acp/claude-code-provider.ts";
import { SEALED_CHILD_ENV_ALLOWLIST } from "../acp/acp-transport.ts";
import type { AcpToolCall, SessionEvent } from "@/contracts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_AGENT = join(HERE, "..", "acp", "stream-json-fixture-agent.mjs");
const ALLOW_ALL: PermissionResolver = () => ({ axis: "session" });
const DENY_ALL: PermissionResolver = () => ({ axis: "deny" });

function makeProvider(opts: {
  broker: Broker;
  store: InMemorySessionStore;
  resolvePermission: PermissionResolver;
  performed: string[];
  events: SessionEvent[];
}): ClaudeCodeProvider {
  const provider = new ClaudeCodeProvider({
    broker: opts.broker,
    store: opts.store,
    cwd: "/tmp/worktree-native",
    model: "Claude Code (native)",
    // The "real CLI" = node replaying the recorded fixture over the same protocol.
    command: process.execPath,
    args: [FIXTURE_AGENT],
    resolvePermission: opts.resolvePermission,
    perform: (call: AcpToolCall) => opts.performed.push(`${call.kind}:${call.target}`),
  });
  provider.subscribe((e) => opts.events.push(e));
  return provider;
}

describe("native Claude-Code adapter — broker-mediated stream-json run", () => {
  it("streams the deterministic transcript and runs every tool through the broker", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const events: SessionEvent[] = [];
    const performed: string[] = [];
    const provider = makeProvider({ broker, store, resolvePermission: ALLOW_ALL, performed, events });

    try {
      const sessionId = await provider.start("Mark the TODO done");

      expect(events.some((e) => e.type === "done")).toBe(true);
      // The model streamed assistant text as token deltas (3 in the fixture).
      expect(events.filter((e) => e.type === "token").length).toBe(3);
      // Both tools cleared the broker and performed their side effect, in order.
      expect(performed).toEqual(["file-read:README.md", "file-write:TODO-done.md"]);

      const stored = await store.get(sessionId);
      expect(stored?.model).toBe("Claude Code (native)");
      expect(stored?.status).toBe("done");

      // Every action went through the broker audit — the chokepoint is intact.
      const outcomes = broker.audit.list().map((a) => `${a.capability}:${a.outcome}`);
      expect(outcomes).toContain("file-read:executed");
      expect(outcomes).toContain("file-write:executed");
      // The recorded tool blocks landed in the transcript (executed, not blocked).
      const resumed = await store.resume(sessionId);
      const toolKinds = resumed.blocks
        .filter((b) => b.type === "tool")
        .map((b) => (b as { block: { kind: string } }).block.kind);
      expect(toolKinds).toContain("Read");
      expect(toolKinds).toContain("Edit");
    } finally {
      provider.close();
    }
  });

  it("DENIED gate ⇒ no side effect, no executed audit, blocked in the transcript", async () => {
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const events: SessionEvent[] = [];
    const performed: string[] = [];
    const provider = makeProvider({ broker, store, resolvePermission: DENY_ALL, performed, events });

    try {
      const sessionId = await provider.start("Mark the TODO done");

      expect(events.some((e) => e.type === "done")).toBe(true);
      // file-read is allowlisted (`allow`) so it runs even under deny-all; the
      // file-WRITE is untrusted egress → hard `ask` → deny-all blocks it.
      expect(performed).toEqual(["file-read:README.md"]);

      const outcomes = broker.audit.list().map((a) => `${a.capability}:${a.outcome}`);
      expect(outcomes).toContain("file-read:executed");
      // The denied write NEVER produced an executed audit (no side effect).
      expect(outcomes).not.toContain("file-write:executed");

      const resumed = await store.resume(sessionId);
      const toolKinds = resumed.blocks
        .filter((b) => b.type === "tool")
        .map((b) => (b as { block: { kind: string } }).block.kind);
      expect(toolKinds).toContain("Edit (blocked)");
      expect(toolKinds).not.toContain("Edit");
    } finally {
      provider.close();
    }
  });
});

describe("native Claude-Code adapter — sealed subprocess + client-assigned taint", () => {
  it("the credential-free sealed env never leaks a key into the child", () => {
    // The allowlist (shared with the ACP transport) carries no credential var.
    expect(SEALED_CHILD_ENV_ALLOWLIST).not.toContain("ANTHROPIC_API_KEY");
    expect(SEALED_CHILD_ENV_ALLOWLIST).not.toContain("CAPISCO_ACP_API_KEY");
    // It is the minimal start set only.
    for (const v of SEALED_CHILD_ENV_ALLOWLIST) {
      expect(["PATH", "HOME", "TMPDIR"]).toContain(v);
    }
  });

  it("forces the model-derived egress through the gate even though the protocol carries no per-call flag", async () => {
    // The native stream-json protocol gives the model no `fromUntrusted` channel,
    // so the CLIENT's session-level taint is the only thing that decides. With a
    // deny-all resolver the untrusted file-write is gated; the audit records the
    // untrusted `ask` (the lethal-trifecta gate) but NO executed write.
    const broker = new Broker();
    const store = new InMemorySessionStore();
    const events: SessionEvent[] = [];
    const performed: string[] = [];
    const provider = makeProvider({ broker, store, resolvePermission: DENY_ALL, performed, events });
    try {
      await provider.start("Mark the TODO done");
      const writeAudit = broker.audit.list().filter((a) => a.capability === "file-write");
      // The write was authorized as untrusted (ask gate fired) but never executed.
      expect(writeAudit.some((a) => a.fromUntrusted && a.outcome === "ask")).toBe(true);
      expect(writeAudit.some((a) => a.outcome === "executed")).toBe(false);
    } finally {
      provider.close();
    }
  });
});
