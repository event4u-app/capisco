// @vitest-environment node
/**
 * Cross-Project Session-Bridge tests (road-to-cross-project-knowledge P2) — the
 * full lethal-trifecta surface, verified against deterministic fakes. NO live
 * cross-project cloud egress: the egress is exercised through fake resolvers and
 * a no-op `performEgress`, never a real network call (the live go stays a
 * deferred, explicit user decision).
 *
 * Two legs break, deliberately redundant:
 *   - EGRESS HUMAN-GATE (AK-C3): A-context → B's cloud prompt is a hard `ask`,
 *     never auto, never pre-cleared by a session/scoped grant.
 *   - QUARANTINE (AK-C1 + AK-C2): the A→B extraction refuses value-shaped
 *     secrets and emits curated excerpts, never full text.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CrossProjectExcerpt,
  PermissionDecision,
  ProjectStoreEntry,
  TranscriptBlock,
} from "@/contracts";
import { Broker, InMemoryAuditStore } from "../broker/index.ts";
import { createInMemorySessionStore } from "../session/in-memory-session-store.ts";
import {
  CrossProjectBridgeImpl,
  createProjectStoreFederation,
} from "../cross-project/cross-project-bridge.ts";
import { carriesSecret, redactToExcerpt, MAX_SNIPPET } from "../cross-project/redact-excerpt.ts";

function msg(id: string, body: string): TranscriptBlock {
  return { type: "message", block: { id, role: "agent", body } };
}

/**
 * Seed two mock projects (A = frontend, B = backend) each with a persistent
 * session store. Project A's frontend session carries one clean knowledge block
 * AND one block with a value-shaped secret (the leak vector). Deterministic —
 * the store's monotonic `seq` orders everything, no Date.now / Math.random.
 */
async function seedFederation(): Promise<ProjectStoreEntry[]> {
  const aStore = createInMemorySessionStore();
  const aSession = await aStore.create({ model: "m/large", title: "Frontend auth flow" });
  await aStore.append(
    aSession.id,
    msg("a-1", "The frontend posts the login form to /api/session and reads the cookie."),
  );
  // The leak vector: a block that accidentally captured a credential value.
  await aStore.append(
    aSession.id,
    msg("a-2", "debug: connected with password=h0rse-battery-staple to the db"),
  );
  await aStore.append(
    aSession.id,
    msg("a-3", "The session cookie is httpOnly; the frontend never reads the token directly."),
  );

  const bStore = createInMemorySessionStore();
  const bSession = await bStore.create({ model: "m/large", title: "Backend session store" });
  await bStore.append(bSession.id, msg("b-1", "Backend persists the session in redis."));

  return [
    { path: "/w/frontend", name: "frontend", store: aStore },
    { path: "/w/backend", name: "backend", store: bStore },
  ];
}

const ALLOW: PermissionDecision = { axis: "session" };
const DENY: PermissionDecision = { axis: "deny" };

describe("redactToExcerpt (AK-C1 + AK-C2 — quarantine)", () => {
  it("REFUSES a value-shaped secret (password=…) — never passes it through", () => {
    const out = redactToExcerpt("debug password=h0rse-battery-staple here", "debug");
    expect(out.refused).toBe(true);
  });

  it("refuses token:/bearer/private-key shapes", () => {
    expect(carriesSecret("token: abcdef0123456789abcdef")).toBe(true);
    expect(carriesSecret("Authorization: Bearer abcdef0123456789abcd")).toBe(true);
    expect(carriesSecret("-----BEGIN RSA PRIVATE KEY-----")).toBe(true);
  });

  it("emits a CURATED snippet (never the full body) for a clean block", () => {
    const long = "x ".repeat(400) + "needle in the haystack " + "y ".repeat(400);
    const out = redactToExcerpt(long, "needle");
    expect(out.refused).toBe(false);
    if (!out.refused) {
      expect(out.snippet.length).toBeLessThanOrEqual(MAX_SNIPPET + 2); // + ellipses
      expect(out.snippet).toContain("needle");
      expect(out.snippet.length).toBeLessThan(long.length);
    }
  });

  it("does not flag ordinary prose as a secret", () => {
    expect(carriesSecret("the frontend reads the cookie from the response")).toBe(false);
  });
});

describe("CrossProjectBridge — read gate (AK-C4 fail-closed)", () => {
  let projects: ProjectStoreEntry[];
  beforeEach(async () => {
    projects = await seedFederation();
  });

  it("returns NO excerpts when the cross-project read is not authorized (default deny)", async () => {
    const broker = new Broker();
    const bridge = new CrossProjectBridgeImpl({ projects, broker }); // deny-all default
    const res = await bridge.searchProject("/w/frontend", "cookie");
    expect(res.authorized).toBe(false);
    expect(res.excerpts).toEqual([]);
  });

  it("audits the cross-project-read authorize BEFORE any read (append-only)", async () => {
    const audit = new InMemoryAuditStore();
    const broker = new Broker({ audit });
    const bridge = new CrossProjectBridgeImpl({ projects, broker });
    await bridge.searchProject("/w/frontend", "cookie");
    const reads = broker.audit.list().filter((e) => e.capability === "cross-project-read");
    expect(reads.length).toBeGreaterThan(0);
    expect(reads[0].outcome).toBe("ask"); // fail-closed
    expect(reads[0].target).toBe("/w/frontend");
  });

  it("returns curated excerpts once a human authorizes the read (AK-C5)", async () => {
    const broker = new Broker();
    const resolveRead = vi.fn(() => ALLOW);
    const bridge = new CrossProjectBridgeImpl({ projects, broker, resolveRead });
    const res = await bridge.searchProject("/w/frontend", "cookie");
    expect(res.authorized).toBe(true);
    expect(resolveRead).toHaveBeenCalledTimes(1);
    expect(res.excerpts.length).toBeGreaterThan(0);
  });

  it("returns nothing for an unknown source project", async () => {
    const broker = new Broker();
    const bridge = new CrossProjectBridgeImpl({ projects, broker, resolveRead: () => ALLOW });
    const res = await bridge.searchProject("/w/does-not-exist", "x");
    expect(res.authorized).toBe(false);
    expect(res.excerpts).toEqual([]);
  });
});

describe("CrossProjectBridge — cross-project excerpt is provably secret-free", () => {
  it("drops the secret-carrying block; the shared excerpt set is secret-free across the boundary", async () => {
    const projects = await seedFederation();
    const broker = new Broker();
    const bridge = new CrossProjectBridgeImpl({ projects, broker, resolveRead: () => ALLOW });

    // Search a term present in BOTH the clean blocks and (via "the") the secret
    // block's neighbours — then assert NO returned excerpt carries a secret.
    const res = await bridge.searchProject("/w/frontend", "the");
    expect(res.authorized).toBe(true);
    expect(res.excerpts.length).toBeGreaterThan(0);
    // The negative assert ACROSS THE PROJECT BOUNDARY (mandatory):
    for (const e of res.excerpts) {
      expect(carriesSecret(e.snippet)).toBe(false);
      expect(e.snippet).not.toContain("password=");
      expect(e.snippet).not.toContain("h0rse-battery-staple");
    }
    // The secret block (a-2) is never represented.
    expect(res.excerpts.some((e) => e.blockId === "a-2")).toBe(false);
  });

  it("curateFromSession scopes to ONE named A-session (AK-C5), still secret-free", async () => {
    const projects = await seedFederation();
    const broker = new Broker();
    const bridge = new CrossProjectBridgeImpl({ projects, broker, resolveRead: () => ALLOW });
    const all = await bridge.searchProject("/w/frontend", "the");
    const sessionId = all.excerpts[0].sessionId;
    const scoped = await bridge.curateFromSession("/w/frontend", sessionId, "the");
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.every((e) => e.sessionId === sessionId)).toBe(true);
    for (const e of scoped) expect(carriesSecret(e.snippet)).toBe(false);
  });

  it("deterministic hit set — same seed, same order (monotonic seq, no Date.now)", async () => {
    const run = async () => {
      const projects = await seedFederation();
      const bridge = new CrossProjectBridgeImpl({
        projects,
        broker: new Broker(),
        resolveRead: () => ALLOW,
      });
      const res = await bridge.searchProject("/w/frontend", "the");
      return res.excerpts.map((e) => e.blockId);
    };
    expect(await run()).toEqual(await run());
  });
});

describe("CrossProjectBridge — egress gate (AK-C3 hard human-gate)", () => {
  const EXCERPTS: CrossProjectExcerpt[] = [
    {
      projectPath: "/w/frontend",
      projectName: "frontend",
      sessionId: "sess-1",
      blockId: "a-1",
      title: "Frontend auth flow",
      snippet: "the frontend posts the login form to /api/session",
    },
  ];

  it("default fail-closed → GATED, nothing leaves the machine", async () => {
    const performEgress = vi.fn();
    const broker = new Broker();
    const bridge = new CrossProjectBridgeImpl({ projects: [], broker, performEgress }); // deny-all egress
    const out = await bridge.injectIntoPrompt(EXCERPTS, "cloud:anthropic/claude");
    expect(out.status).toBe("gated");
    expect(performEgress).not.toHaveBeenCalled();
  });

  it("audits the untrusted-egress ask BEFORE any send (no executed record when gated)", async () => {
    const broker = new Broker();
    const bridge = new CrossProjectBridgeImpl({ projects: [], broker });
    await bridge.injectIntoPrompt(EXCERPTS, "cloud:anthropic/claude");
    const audit = broker.audit.list();
    const egressAsk = audit.find((e) => e.capability === "network" && e.fromUntrusted);
    expect(egressAsk?.outcome).toBe("ask");
    // Fail-closed → no `executed` network record.
    expect(audit.some((e) => e.capability === "network" && e.outcome === "executed")).toBe(false);
  });

  it("only a per-call human decision sends it — executed as the HUMAN principal", async () => {
    const performEgress = vi.fn();
    const broker = new Broker();
    const resolveEgress = vi.fn(() => ALLOW);
    const bridge = new CrossProjectBridgeImpl({ projects: [], broker, resolveEgress, performEgress });
    const out = await bridge.injectIntoPrompt(EXCERPTS, "cloud:anthropic/claude");
    expect(out.status).toBe("sent");
    expect(resolveEgress).toHaveBeenCalledTimes(1);
    expect(performEgress).toHaveBeenCalledTimes(1);
    // The executed audit record is the HUMAN principal over a trusted request.
    const executed = broker.audit.list().find((e) => e.capability === "network" && e.outcome === "executed");
    expect(executed?.principalKind).toBe("human");
    expect(executed?.fromUntrusted).toBe(false);
  });

  it("a human DENY keeps it gated", async () => {
    const performEgress = vi.fn();
    const broker = new Broker();
    const bridge = new CrossProjectBridgeImpl({
      projects: [],
      broker,
      resolveEgress: () => DENY,
      performEgress,
    });
    const out = await bridge.injectIntoPrompt(EXCERPTS, "cloud:anthropic/claude");
    expect(out.status).toBe("gated");
    expect(performEgress).not.toHaveBeenCalled();
  });

  it("a session-grant on an untrusted egress can NOT pre-clear a later egress (MUST-NOT 4)", async () => {
    const performEgress = vi.fn();
    const broker = new Broker();
    // First call: human clears once (session axis) → sent.
    const bridge = new CrossProjectBridgeImpl({
      projects: [],
      broker,
      resolveEgress: () => ALLOW,
      performEgress,
    });
    await bridge.injectIntoPrompt(EXCERPTS, "cloud:anthropic/claude");
    expect(performEgress).toHaveBeenCalledTimes(1);

    // Second call with deny-all resolver: the prior `session` grant must NOT
    // pre-clear this untrusted egress — it re-asks, denies, stays gated.
    const bridge2 = new CrossProjectBridgeImpl({
      projects: [],
      broker, // SAME broker — the grant store is shared
      resolveEgress: () => DENY,
      performEgress,
    });
    const out2 = await bridge2.injectIntoPrompt(EXCERPTS, "cloud:anthropic/claude");
    expect(out2.status).toBe("gated");
    expect(performEgress).toHaveBeenCalledTimes(1); // still 1 — no second send
  });
});

describe("createProjectStoreFederation (P2 prerequisite — persistent cross-project store seam)", () => {
  it("collects per-project stores and defends against later caller mutation", async () => {
    const projects = await seedFederation();
    const federation = createProjectStoreFederation(projects);
    // Mutating the caller's array does NOT add a project to the federation.
    projects.push({ path: "/w/sneaky", name: "sneaky", store: createInMemorySessionStore() });
    expect(federation.find((e) => e.path === "/w/sneaky")).toBeUndefined();
    expect(federation.map((e) => e.path).sort()).toEqual(["/w/backend", "/w/frontend"]);
  });
});

describe("CrossProjectBridge — knowledge ≠ access (AK-C6)", () => {
  it("the bridge output is text excerpts only — no executable handle to project A", async () => {
    const projects = await seedFederation();
    const broker = new Broker();
    const bridge = new CrossProjectBridgeImpl({ projects, broker, resolveRead: () => ALLOW });
    const res = await bridge.searchProject("/w/frontend", "cookie");
    for (const e of res.excerpts) {
      // The excerpt is pure data: provenance + a string snippet. No fs/shell/
      // worktree/container handle exists on the shape.
      expect(Object.keys(e).sort()).toEqual(
        ["blockId", "projectName", "projectPath", "sessionId", "snippet", "title"].sort(),
      );
      expect(typeof e.snippet).toBe("string");
    }
  });
});
