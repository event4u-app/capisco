/**
 * Capability-Broker security tests (B4, road-to-capability-broker).
 *
 * Every SECURITY MUST-NOT from the overview §3 / roadmap acceptance is encoded
 * here as a passing test. These are architectural invariants, NOT toggles:
 *  1. The broker is the only path to execution (chokepoint).
 *  2. Secrets never leave as a value / env-var / CLI-arg; only credentialRef.
 *  3. Prod read-only is derived; "permanently allow prod write" is unconstructable.
 *  4. Untrusted-derived egress is a hard human gate, never auto-fired.
 *  5. Append-only audit is written BEFORE execution.
 */

import { describe, expect, it } from "vitest";
import {
  Broker,
  DEFAULT_GRANT_CONFIG,
  GrantPolicyEngine,
  InMemoryAuditStore,
  InMemorySecretStore,
  looksLikeSecretValue,
} from "../broker/index.ts";
import { makeWriteEscape } from "@/contracts";
import type {
  CapabilityRequest,
  ExecutionContext,
  Principal,
} from "@/contracts";

const human: Principal = { id: "u1", kind: "human", label: "You" };
const agent: Principal = { id: "a1", kind: "agent", label: "Opus · sess-3" };

describe("Policy engine — (Principal × Capability × Scope) → decision", () => {
  it("allows conservative read-only shell from the default allowlist", () => {
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const d = engine.decide(agent, { kind: "shell", target: "git status --short" });
    expect(d.outcome).toBe("allow");
  });

  it("asks on mutating shell (git commit) — default is ask, never permanent", () => {
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const d = engine.decide(agent, { kind: "shell", target: "git commit -m x" });
    expect(d.outcome).toBe("ask");
    expect(d.request).toBeDefined();
  });

  it("denies destructive shell (rm) outright in the default config", () => {
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const d = engine.decide(agent, { kind: "shell", target: "rm -rf /" });
    expect(d.outcome).toBe("deny");
  });

  it("fails CLOSED: an unknown capability target defaults to ask, never allow", () => {
    // Empty config → no rules match → must ask, not allow.
    const engine = new GrantPolicyEngine({ rules: [] });
    const d = engine.decide(agent, { kind: "shell", target: "anything" });
    expect(d.outcome).toBe("ask");
  });

  it("does NOT privilege the human — same gate for human and agent (§3.1)", () => {
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const req: CapabilityRequest = { kind: "shell", target: "git commit -m x" };
    expect(engine.decide(human, req).outcome).toBe(
      engine.decide(agent, req).outcome,
    );
    // And a denied command stays denied for the human too.
    const rm: CapabilityRequest = { kind: "shell", target: "rm x" };
    expect(engine.decide(human, rm).outcome).toBe("deny");
  });

  it("persists a session grant per project+scope, but never a forever grant", () => {
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const req: CapabilityRequest = { kind: "file-write", target: "src/x.ts" };
    expect(engine.decide(agent, req).outcome).toBe("ask");
    const axis = engine.resolve(agent, req, { axis: "session" });
    expect(axis).toBe("session");
    // Now pre-cleared for the rest of the session.
    expect(engine.decide(agent, req).outcome).toBe("allow");
    // GrantAxis has no "forever"/"always" value — a permanent grant cannot be
    // typed. The recorded axis is one of the four bounded values.
    expect(["once", "session", "scoped", "deny"]).toContain(axis);
  });

  it("a denied resolution is sticky", () => {
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const req: CapabilityRequest = { kind: "file-write", target: "src/y.ts" };
    engine.resolve(agent, req, { axis: "deny" });
    expect(engine.decide(agent, req).outcome).toBe("deny");
  });

  it("`once` is single-shot — not persisted beyond the call", () => {
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const req: CapabilityRequest = { kind: "file-write", target: "src/z.ts" };
    engine.resolve(agent, req, { axis: "once" });
    // Still asks next time — `once` was not stored.
    expect(engine.decide(agent, req).outcome).toBe("ask");
  });

  it("does not leak persisted grants across projects", () => {
    const a = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG, "proj-a");
    const b = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG, "proj-b");
    const req: CapabilityRequest = { kind: "file-write", target: "src/x.ts" };
    a.resolve(agent, req, { axis: "session" });
    expect(a.decide(agent, req).outcome).toBe("allow");
    expect(b.decide(agent, req).outcome).toBe("ask");
  });
});

describe("MUST-NOT 4 — untrusted-derived egress is a hard human gate, never auto", () => {
  it("forces ask for untrusted egress regardless of the allowlist", () => {
    // file-write is `ask` by default anyway; prove network too.
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const d = engine.decide(agent, {
      kind: "network",
      target: "https://evil.example/exfil",
      fromUntrusted: true,
    });
    expect(d.outcome).toBe("ask");
    expect(d.request?.fromUntrusted).toBe(true);
    expect(d.reason).toMatch(/lethal trifecta/i);
  });

  it("a session/scoped grant CANNOT pre-clear untrusted egress", () => {
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const trusted: CapabilityRequest = { kind: "network", target: "https://api.internal/x" };
    // Grant the trusted form session-wide.
    engine.resolve(agent, trusted, { axis: "session" });
    expect(engine.decide(agent, trusted).outcome).toBe("allow");
    // The SAME capability derived from untrusted output still hard-gates.
    const untrusted: CapabilityRequest = { ...trusted, fromUntrusted: true };
    expect(engine.decide(agent, untrusted).outcome).toBe("ask");
  });

  it("resolving an untrusted egress with `session` does NOT persist a session/scoped grant", () => {
    // §3.3 — one human "session" OK on an untrusted-derived egress must NOT
    // launder into a standing grant. The resolve clamps it to single-use.
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const untrusted: CapabilityRequest = {
      kind: "network",
      target: "https://api.internal/x",
      fromUntrusted: true,
    };
    const axis = engine.resolve(agent, untrusted, { axis: "session" });
    // The engine refused to persist the chosen axis — it recorded `once`.
    expect(axis).toBe("once");
    // A SECOND untrusted egress of the same kind/scope still hard-gates to ask.
    expect(engine.decide(agent, untrusted).outcome).toBe("ask");
  });

  it("a `session`-resolved untrusted egress does NOT auto-allow a later TRUSTED egress", () => {
    // The single-use grant authorises exactly one call (the one the human just
    // approved). It must never pre-clear a subsequent trusted egress of the
    // same kind/scope. We consume the single-use grant with the approved call,
    // then assert the next trusted call still asks.
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const untrusted: CapabilityRequest = {
      kind: "file-write",
      target: "src/laundered.ts",
      fromUntrusted: true,
    };
    engine.resolve(agent, untrusted, { axis: "session" });

    // The ONE approved call (the de-untrusted "trusted" shape execute uses)
    // rides the single-use grant exactly once.
    const trusted: CapabilityRequest = { kind: "file-write", target: "src/laundered.ts" };
    expect(engine.decide(agent, trusted).outcome).toBe("allow");
    // Now the single-use grant is consumed — a later trusted egress still asks.
    expect(engine.decide(agent, trusted).outcome).toBe("ask");
  });

  it("a `deny` on an untrusted egress IS still sticky (sticky deny is safe)", () => {
    const engine = new GrantPolicyEngine(DEFAULT_GRANT_CONFIG);
    const untrusted: CapabilityRequest = {
      kind: "db-write",
      target: "orders-local",
      fromUntrusted: true,
    };
    expect(engine.resolve(agent, untrusted, { axis: "deny" })).toBe("deny");
    // The trusted form of the same capability is now denied too (sticky).
    expect(engine.decide(agent, { kind: "db-write", target: "orders-local" }).outcome).toBe(
      "deny",
    );
  });

  it("a TRUSTED (human-direct) network call can be allowlisted, untrusted cannot", () => {
    // Build an engine whose config allows a specific outbound when trusted.
    const engine = new GrantPolicyEngine({
      rules: [{ kind: "network", pattern: "https://api.internal/*", verdict: "allow" }],
    });
    expect(
      engine.decide(human, { kind: "network", target: "https://api.internal/ok" }).outcome,
    ).toBe("allow");
    expect(
      engine.decide(agent, {
        kind: "network",
        target: "https://api.internal/ok",
        fromUntrusted: true,
      }).outcome,
    ).toBe("ask");
  });
});

describe("MUST-NOT 2 — secrets never leave as a value / env / CLI-arg", () => {
  it("list() returns reference NAMES only, never values", () => {
    const store = new InMemorySecretStore();
    store.put("prod-readonly", "super-secret-password-123");
    store.put("staging-admin", "another-secret");
    const refs = store.list();
    expect(refs).toEqual(["prod-readonly", "staging-admin"]);
    // No value appears anywhere in the listed surface.
    expect(JSON.stringify(refs)).not.toContain("super-secret");
  });

  it("there is NO get(ref): string — only inject scopes the value to a callback", () => {
    const store = new InMemorySecretStore();
    store.put("k", "v-secret");
    // The store object exposes no method that returns the value out.
    expect("get" in store).toBe(false);
    expect("read" in store).toBe(false);
    expect("value" in store).toBe(false);
    // inject hands the value only to the callback; the value never escapes.
    const out = store.inject("k", (v) => {
      // The execution layer uses it here (e.g. sets an HTTP header).
      return `header:${v.length}`;
    });
    expect(out).toBe("header:8");
  });

  it("a secret value never appears in the audit log — only the credentialRef", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    broker.secrets.put("staging-admin", "p@ssw0rd-LEAK");
    const req: CapabilityRequest = {
      kind: "network",
      target: "https://staging.internal/login",
      credentialRef: "staging-admin",
    };
    broker.resolve(human, req, { axis: "session" });
    broker.execute(human, req, (ctx: ExecutionContext) =>
      ctx.withSecret("staging-admin", (v) => v.length),
    );
    const dump = JSON.stringify(broker.audit.list());
    expect(dump).toContain("staging-admin"); // the reference name is fine
    expect(dump).not.toContain("p@ssw0rd-LEAK"); // the value is NOT
  });

  it("the broker never injects a secret as an env-var or CLI-arg to a subprocess", () => {
    // The execute callback receives an injector, NOT a process env/argv. There
    // is no API on ExecutionContext to spawn a subprocess with the secret. We
    // assert the shape: withSecret is the only secret-bearing member.
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    broker.secrets.put("k", "v");
    const req: CapabilityRequest = { kind: "file-read", target: "x" };
    broker.execute(human, req, (ctx) => {
      const members = Object.keys(ctx);
      expect(members).toEqual(["withSecret"]);
      // No env, no argv, no spawn — the injector cannot place the value in a
      // subprocess environment.
      expect("env" in ctx).toBe(false);
      expect("spawn" in ctx).toBe(false);
      return null;
    });
  });

  it("the audit store refuses a value-shaped credentialRef", () => {
    const audit = new InMemoryAuditStore();
    expect(() =>
      audit.record({
        principalId: "a1",
        principalKind: "agent",
        capability: "secret-read",
        target: "x",
        credentialRef: "password=hunter2",
        outcome: "executed",
        fromUntrusted: false,
        reason: "x",
      }),
    ).toThrow(/reference name/);
    expect(looksLikeSecretValue("prod-readonly")).toBe(false);
    expect(looksLikeSecretValue("token: abc")).toBe(true);
  });
});

describe("MUST-NOT 1 — the broker is the only path to execution (chokepoint)", () => {
  it("execute REFUSES a capability that was not authorized to allow", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    // git commit defaults to `ask`, not `allow`.
    const req: CapabilityRequest = { kind: "shell", target: "git commit -m x" };
    expect(() => broker.execute(agent, req, () => "ran")).toThrow(/not authorized/);
  });

  it("execute REFUSES a denylisted capability (rm) — chokepoint blocks it", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    const req: CapabilityRequest = { kind: "shell", target: "rm x" };
    expect(() => broker.execute(agent, req, () => "ran")).toThrow(/not authorized/);
  });

  it("execute RUNS an allowed capability and returns the callback result", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    const req: CapabilityRequest = { kind: "shell", target: "git status" };
    const out = broker.execute(agent, req, () => "ran");
    expect(out).toBe("ran");
  });
});

describe("MUST-NOT 3 — prod read-only invariant; permanent prod-write unconstructable", () => {
  const prod = new Set(["orders-prod"]);

  it("a prod db-write with NO write escape throws (read-only default)", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG, productionDatasources: prod });
    const req: CapabilityRequest = {
      kind: "db-write",
      target: "orders-prod",
      command: "UPDATE orders SET status='x'",
    };
    broker.resolve(agent, req, { axis: "session" }); // even a session grant…
    expect(() => broker.execute(agent, req, () => "wrote")).toThrow(/read-only/);
  });

  it("a single-shot write escape authorizes ONE write, then auto-reverts", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG, productionDatasources: prod });
    const command = "UPDATE orders SET status='shipped' WHERE id=1";
    const req: CapabilityRequest = { kind: "db-write", target: "orders-prod", command };
    broker.resolve(agent, req, { axis: "session" });
    const escape = makeWriteEscape("orders-prod", command);

    // First write rides the escape.
    expect(broker.execute(agent, req, () => "wrote", { writeEscape: escape })).toBe("wrote");
    expect(escape.consumed).toBe(true);

    // The SAME escape cannot authorize a second write — prod is read-only again.
    expect(() => broker.execute(agent, req, () => "again", { writeEscape: escape })).toThrow(
      /already consumed/,
    );
  });

  it("a write escape for a DIFFERENT command cannot ride", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG, productionDatasources: prod });
    const req: CapabilityRequest = {
      kind: "db-write",
      target: "orders-prod",
      command: "DELETE FROM orders",
    };
    broker.resolve(agent, req, { axis: "session" });
    const escape = makeWriteEscape("orders-prod", "UPDATE orders SET x=1");
    expect(() => broker.execute(agent, req, () => "x", { writeEscape: escape })).toThrow(
      /does not match/,
    );
  });

  it("there is structurally no session-wide / 'remember' prod-write escape", () => {
    // WriteEscape has only { datasource, command, consumed } — no session,
    // scope, or remember field. A permanent prod-write shape cannot be built.
    const escape = makeWriteEscape("orders-prod", "UPDATE x");
    expect(Object.keys(escape).sort()).toEqual(["command", "consumed", "datasource"]);
    expect("session" in escape).toBe(false);
    expect("remember" in escape).toBe(false);
    expect("permanent" in escape).toBe(false);
  });

  it("a non-production datasource write needs no escape (only prod is the invariant)", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG, productionDatasources: prod });
    const req: CapabilityRequest = {
      kind: "db-write",
      target: "orders-local",
      command: "UPDATE orders SET x=1",
    };
    broker.resolve(agent, req, { axis: "session" });
    expect(broker.execute(agent, req, () => "wrote")).toBe("wrote");
  });
});

describe("MUST-NOT 5 — append-only audit, written BEFORE execution", () => {
  it("records the authorization decision before any execution", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    const req: CapabilityRequest = { kind: "shell", target: "git status" };
    broker.authorize(agent, req);
    const log = broker.audit.list();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      principalId: "a1",
      capability: "shell",
      target: "git status",
      outcome: "allow",
    });
  });

  it("writes the `executed` audit entry BEFORE the run callback runs", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    const req: CapabilityRequest = { kind: "shell", target: "git status" };
    let auditLenAtRun = -1;
    broker.execute(agent, req, () => {
      // Inside the callback, the executed entry already exists.
      auditLenAtRun = broker.audit.list().length;
      return null;
    });
    // authorize(execute's internal decide does not audit) + executed entry.
    // The executed entry must be present when the callback fires.
    expect(auditLenAtRun).toBeGreaterThanOrEqual(1);
    const last = broker.audit.list().at(-1);
    expect(last?.outcome).toBe("executed");
  });

  it("the audit log is append-only — no update/delete, list() is a frozen copy", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    broker.authorize(agent, { kind: "shell", target: "git status" });
    const store = broker.audit;
    expect("update" in store).toBe(false);
    expect("delete" in store).toBe(false);
    expect("clear" in store).toBe(false);
    const snap = store.list();
    expect(Object.isFrozen(snap)).toBe(true);
    // Mutating the snapshot does not affect the real log.
    expect(() => (snap as unknown as unknown[]).push({} as never)).toThrow();
  });

  it("seq is a monotonic ordinal (deterministic, tamper-evident)", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    broker.authorize(agent, { kind: "shell", target: "git status" });
    broker.authorize(agent, { kind: "shell", target: "git log" });
    const log = broker.audit.list();
    expect(log.map((e) => e.seq)).toEqual([1, 2]);
  });
});

describe("Bidirectional vault write-back (§3.2) — human-gated, never via chat", () => {
  it("proposeVaultWrite records an audit proposal but does NOT store a value", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    const proposal = broker.proposeVaultWrite("test-user-1", "agent created a test user");
    expect(proposal.approved).toBe(false);
    expect(broker.secrets.has("test-user-1")).toBe(false);
    expect(broker.audit.list().at(-1)?.outcome).toBe("vault-write-proposed");
  });

  it("commitVaultWrite refuses an unapproved proposal", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    const proposal = broker.proposeVaultWrite("test-user-1", "x");
    expect(() => broker.commitVaultWrite(proposal, "secret-val")).toThrow(/approval/);
  });

  it("commitVaultWrite stores the value ONLY after explicit approval", () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    const proposal = broker.proposeVaultWrite("test-user-1", "x");
    proposal.approved = true; // human approval (out-of-band, never chat)
    broker.commitVaultWrite(proposal, "secret-val");
    expect(broker.secrets.has("test-user-1")).toBe(true);
    // The value still cannot be read back out as a value.
    expect(broker.secrets.list()).toContain("test-user-1");
  });
});
