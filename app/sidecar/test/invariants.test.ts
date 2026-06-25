/**
 * Adversarial invariant suite (road-to-actually-works P1, Overview §4.4).
 *
 * These tests TRY to violate the six unnegotiable invariants (Overview §3) and
 * assert the gate HOLDS. The council read-through flagged that "connect to
 * reality" is exactly when a security gate silently regresses — a manual screen
 * check cannot defend a security spine across many phases, so the invariants
 * live entirely in the automated column. Each test is an attack; green = the
 * attack failed.
 *
 * Run in the fast lane on every PR (pure logic, no real dependency).
 */

import { describe, expect, it, vi } from "vitest";

import { Broker } from "../broker/capability-broker.ts";
import { InMemoryAuditStore } from "../broker/audit-store.ts";
import { InMemorySecretStore } from "../broker/in-memory-secret-store.ts";
import type { PolicyEngine } from "@/contracts";
import { sealedEnv } from "../supervisor/process-supervisor.ts";

const AGENT = { id: "agent-1", kind: "agent", label: "Agent" } as const;

/** Permissive stub policy — lets a test reach the POST-grant chokepoints. */
const allowAll: PolicyEngine = {
  decide: () => ({ outcome: "allow", reason: "test-allow-all" }),
  resolve: () => "session",
} as unknown as PolicyEngine;

function fileWrite(target: string) {
  return { kind: "file-write", target } as never;
}

describe("Invariant 1 — broker is an un-bypassable execution chokepoint", () => {
  it("execute() WITHOUT a grant throws — no bypass", () => {
    const broker = new Broker();
    const run = vi.fn();
    expect(() => broker.execute(AGENT, fileWrite("src/a.ts"), run as never)).toThrow(
      /not authorized/i,
    );
    expect(run).not.toHaveBeenCalled(); // the side-effect never ran
  });

  it("a FORGED grant id is rejected", () => {
    const broker = new Broker();
    const run = vi.fn();
    expect(() =>
      broker.execute(AGENT, fileWrite("src/a.ts"), run as never, {
        grant: { id: "grant-forged" } as never,
      }),
    ).toThrow(/not authorized/i);
    expect(run).not.toHaveBeenCalled();
  });

  it("a grant is SINGLE-USE — replay is rejected", () => {
    const broker = new Broker({ policy: allowAll });
    const req = fileWrite("src/a.ts");
    const decision = broker.authorize(AGENT, req);
    const grant = (decision as { grant?: { id: string } }).grant;
    expect(grant).toBeTruthy();

    const first = broker.execute(AGENT, req, () => "ran", { grant });
    expect(first).toBe("ran");
    // Replay with the same (now consumed) grant must fail.
    expect(() => broker.execute(AGENT, req, () => "again", { grant })).toThrow(/not authorized/i);
  });

  it("a grant for one request can NOT authorize a different request", () => {
    const broker = new Broker({ policy: allowAll });
    const decision = broker.authorize(AGENT, fileWrite("src/a.ts"));
    const grant = (decision as { grant?: { id: string } }).grant;
    // Try to ride the grant minted for a.ts to write b.ts.
    expect(() => broker.execute(AGENT, fileWrite("src/b.ts"), () => "x", { grant })).toThrow(
      /not authorized/i,
    );
  });
});

describe("Invariant 2 — append-only audit, written BEFORE execution", () => {
  it("authorize records an audit entry before any execute runs", () => {
    const broker = new Broker({ policy: allowAll });
    const req = fileWrite("src/a.ts");
    broker.authorize(AGENT, req);
    const log = broker.audit.list();
    expect(log.length).toBe(1);
    expect(log[0].capability).toBe("file-write");
    expect(log[0].outcome).toBe("allow");
  });

  it("the audit store is structurally append-only — no delete/update surface", () => {
    const audit = new InMemoryAuditStore() as unknown as Record<string, unknown>;
    expect(typeof audit.delete).toBe("undefined");
    expect(typeof audit.update).toBe("undefined");
    expect(typeof audit.clear).toBe("undefined");
    expect(typeof audit.remove).toBe("undefined");
  });

  it("list() does not expose a mutable handle that survives", () => {
    const store = new InMemoryAuditStore();
    store.record({
      principalId: "a", principalKind: "agent", capability: "file-write",
      target: "x", outcome: "allow", fromUntrusted: false,
    } as never);
    const a = store.list();
    expect(a.length).toBe(1);
    // Even if a caller mutates the returned array, the store's truth is unchanged.
    try {
      (a as unknown as unknown[]).push({ forged: true });
    } catch {
      /* frozen — even better */
    }
    expect(store.list().length).toBe(1);
  });
});

describe("Invariant 4 — lethal-trifecta: untrusted egress can NEVER auto-allow", () => {
  it("a request fromUntrusted is forced to ask, never allow", () => {
    const broker = new Broker(); // default conservative policy
    const decision = broker.authorize(AGENT, {
      kind: "http",
      target: "https://evil.example/exfil",
      fromUntrusted: true,
    } as never);
    expect((decision as { outcome: string }).outcome).toBe("ask");
    expect((decision as { outcome: string }).outcome).not.toBe("allow");
  });

  it("even a permissive policy cannot mint a grant for untrusted egress via the default engine", () => {
    // With the conservative default engine, no untrusted-egress decision is `allow`,
    // so no single-use grant is minted → execute is impossible without a human clear.
    const broker = new Broker();
    const decision = broker.authorize(AGENT, {
      kind: "http", target: "https://evil.example", fromUntrusted: true,
    } as never);
    expect((decision as { grant?: unknown }).grant).toBeUndefined();
  });
});

describe("Invariant 5 — production datasource is read-only (structural)", () => {
  it("a db-write to a production datasource without an escape is refused", () => {
    const broker = new Broker({ policy: allowAll, productionDatasources: new Set(["prod-db"]) });
    const req = { kind: "db-write", target: "prod-db", command: "DELETE FROM users" } as never;
    const decision = broker.authorize(AGENT, req);
    const grant = (decision as { grant?: { id: string } }).grant;
    expect(() => broker.execute(AGENT, req, () => "wrote", { grant })).toThrow(/read-only/i);
  });

  it("a single-shot write escape is consumed — a replay is refused", () => {
    const prod = new Set(["prod-db"]);
    const broker = new Broker({ policy: allowAll, productionDatasources: prod });
    const command = "UPDATE flags SET on = 1";
    const req = { kind: "db-write", target: "prod-db", command } as never;
    const escape = { id: "esc-1", datasource: "prod-db", command } as never;

    const d1 = broker.authorize(AGENT, req);
    const ok = broker.execute(AGENT, req, () => "wrote-once", {
      grant: (d1 as { grant?: unknown }).grant as never,
      writeEscape: escape,
    });
    expect(ok).toBe("wrote-once");

    // Re-authorize + reuse the SAME escape → refused (single-shot, prod read-only again).
    const d2 = broker.authorize(AGENT, req);
    expect(() =>
      broker.execute(AGENT, req, () => "wrote-twice", {
        grant: (d2 as { grant?: unknown }).grant as never,
        writeEscape: escape,
      }),
    ).toThrow(/already consumed|read-only/i);
  });
});

describe("Invariant 2/secrets — credentials are by-reference, never values", () => {
  it("the audit store refuses a credentialRef that looks like a raw secret value", () => {
    const store = new InMemoryAuditStore();
    expect(() =>
      store.record({
        principalId: "a", principalKind: "agent", capability: "http",
        target: "https://api", credentialRef: "token=sk-ant-abc123def456", outcome: "allow",
        fromUntrusted: false,
      } as never),
    ).toThrow();
  });

  it("the secret store exposes references, not a raw-value getter to the LLM path", () => {
    const store = new InMemorySecretStore() as unknown as Record<string, unknown>;
    // The contract surface is put / list / inject — there is no `get`/`reveal`
    // that hands a raw value back to a caller (secrets inject at the exec layer).
    expect(typeof store.get).toBe("undefined");
    expect(typeof store.reveal).toBe("undefined");
    expect(typeof store.value).toBe("undefined");
  });

  it("the supervised child env carries no secret-shaped vars (defense in depth)", () => {
    const env = sealedEnv({ PATH: "/bin", ANTHROPIC_API_KEY: "sk-ant-leak", GITHUB_TOKEN: "ghp_x" });
    expect(env.PATH).toBe("/bin");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });
});
