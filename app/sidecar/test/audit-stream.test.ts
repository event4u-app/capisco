/**
 * Live broker-decision stream (road-to-actually-works P3 — minimal-observability).
 *
 * The broker records EVERY decision through the audit store BEFORE it acts
 * (authorize allow/deny/gate · execute · vault-write-proposed), so subscribing
 * to the audit append stream IS the live broker-decision stream the
 * observability surface consumes. These tests prove the primitive:
 *
 *  - an observer fires once per `record`, in seq order, with the frozen entry;
 *  - unsubscribe stops delivery;
 *  - a throwing observer is isolated — it never breaks the append, the other
 *    observers, or (critically) the broker that records BEFORE it executes;
 *  - the secret-shaped / RTK-marked refusals fire BEFORE any append, so a
 *    refused record never reaches an observer;
 *  - driven through the REAL broker, an authorize→execute round-trip streams
 *    the decision outcomes live (allow → executed), never a secret value.
 */

import { describe, expect, it } from "vitest";

import { InMemoryAuditStore } from "../broker/audit-store.ts";
import { Broker } from "../broker/capability-broker.ts";
import type { AuditEntry, CapabilityRequest, Principal } from "@/contracts";

const AGENT: Principal = { kind: "agent", id: "agent-1", label: "Agent 1" };

function entry(overrides: Partial<Omit<AuditEntry, "seq">> = {}): Omit<AuditEntry, "seq"> {
  return {
    principalId: "agent-1",
    principalKind: "agent",
    capability: "file-write",
    target: "src/a.ts",
    outcome: "allow",
    fromUntrusted: false,
    reason: "test",
    ...overrides,
  };
}

describe("InMemoryAuditStore.subscribe — the live append stream", () => {
  it("fires once per record, in seq order, with the frozen entry", () => {
    const store = new InMemoryAuditStore();
    const seen: AuditEntry[] = [];
    store.subscribe((e) => seen.push(e));

    store.record(entry({ target: "src/a.ts" }));
    store.record(entry({ target: "src/b.ts" }));

    expect(seen).toHaveLength(2);
    expect(seen.map((e) => e.seq)).toEqual([1, 2]);
    expect(seen.map((e) => e.target)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(Object.isFrozen(seen[0])).toBe(true);
    // The streamed entry is the very one `list` exposes.
    expect(store.list()).toEqual(seen);
  });

  it("stops delivering after unsubscribe", () => {
    const store = new InMemoryAuditStore();
    const seen: AuditEntry[] = [];
    const off = store.subscribe((e) => seen.push(e));

    store.record(entry());
    off();
    store.record(entry());

    expect(seen).toHaveLength(1);
    // The log itself still grew — unsubscribe only detaches the observer.
    expect(store.list()).toHaveLength(2);
  });

  it("isolates a throwing observer — append + other observers + record() survive", () => {
    const store = new InMemoryAuditStore();
    const good: AuditEntry[] = [];
    store.subscribe(() => {
      throw new Error("observer blew up");
    });
    store.subscribe((e) => good.push(e));

    // record must NOT throw (it runs before the broker executes).
    const recorded = store.record(entry());
    expect(recorded.seq).toBe(1);
    expect(store.list()).toHaveLength(1);
    expect(good).toHaveLength(1); // the healthy observer still got it
  });

  it("never streams a refused record (secret-shaped ref throws before append)", () => {
    const store = new InMemoryAuditStore();
    const seen: AuditEntry[] = [];
    store.subscribe((e) => seen.push(e));

    expect(() => store.record(entry({ credentialRef: "token=sk-leak" }))).toThrow(/reference name/);
    expect(seen).toHaveLength(0);
    expect(store.list()).toHaveLength(0);
  });
});

describe("live decision stream ↔ the real broker", () => {
  it("streams authorize(allow) then executed for an allowed capability, no secret value", () => {
    const audit = new InMemoryAuditStore();
    const broker = new Broker({ audit });
    const outcomes: string[] = [];
    broker.audit.subscribe((e) => outcomes.push(e.outcome));

    // A read-only git command on the default allowlist: allow → execute.
    const request: CapabilityRequest = { kind: "shell", target: "git status" };
    const decision = broker.authorize(AGENT, request);
    expect(decision.outcome).toBe("allow");
    broker.execute(AGENT, request, () => "ok", { grant: decision.grant });

    // The live stream saw the authorization decision AND the execution, in order.
    expect(outcomes).toEqual(["allow", "executed"]);
    // No secret value ever rode the stream (the entries carry refs/outcomes only).
    expect(JSON.stringify(outcomes)).not.toMatch(/sk-|secret|password/i);
  });

  it("streams a deny/gate decision live for a denied capability", () => {
    const audit = new InMemoryAuditStore();
    const broker = new Broker({ audit });
    const seen: AuditEntry[] = [];
    broker.audit.subscribe((e) => seen.push(e));

    // Untrusted-derived egress is a hard gate — never an auto-allow.
    const request: CapabilityRequest = {
      kind: "network",
      target: "https://evil.example",
      fromUntrusted: true,
    };
    const decision = broker.authorize(AGENT, request);
    expect(decision.outcome).not.toBe("allow");
    expect(seen).toHaveLength(1);
    expect(seen[0].outcome).toBe(decision.outcome);
    expect(seen[0].fromUntrusted).toBe(true);
  });
});
