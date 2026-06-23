import { describe, expect, it } from "vitest";

import {
  makeDatasource,
  makeWriteEscape,
  type SessionEvent,
} from "@/contracts";
import {
  aggregateTelemetry,
  createInMemoryShadowStore,
  grantOf,
  mockAgentProvider,
  mockRepos,
  mockShadowStore,
  mockWorkspaceProvider,
  mockWorktrees,
} from "./index";

/**
 * B-pre (Backend-Contracts) tests: the async + streaming surface, the
 * permission return channel + grant axis, structured telemetry aggregation, the
 * Repo≠Worktree split, the derived read-only invariant + single-shot write
 * escape, the retry-as-branch session tree, and the History-2 shadow store.
 */

describe("AgentProvider — async + subscribe (Phase 0)", () => {
  it("streams a deterministic event sequence ending in done, no polling", async () => {
    const events: SessionEvent[] = [];
    await new Promise<void>((resolve) => {
      const un = mockAgentProvider.subscribe("s1", (e) => {
        events.push(e);
        if (e.type === "done") {
          un();
          resolve();
        }
      });
    });
    // ACP-shaped: a status transition, token deltas, a permission gate, telemetry, done.
    expect(events[0]).toMatchObject({ type: "status" });
    expect(events.some((e) => e.type === "token")).toBe(true);
    expect(events.some((e) => e.type === "permission")).toBe(true);
    expect(events.some((e) => e.type === "telemetry")).toBe(true);
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("token deltas reconstruct the agent message body (streaming, not snapshot)", async () => {
    const deltas: string[] = [];
    await new Promise<void>((resolve) => {
      const un = mockAgentProvider.subscribe("s2", (e) => {
        if (e.type === "token") deltas.push(e.delta);
        if (e.type === "done") {
          un();
          resolve();
        }
      });
    });
    // Streams the LAST agent message of s2 (design-sync-v2 added a scorecard
    // message s2-m4 after the plan); the contract is delta-reconstruction, not
    // the specific text.
    expect(deltas.join("")).toContain("Readiness scorecard for the grant-model refactor");
  });

  it("unsubscribe stops further events", async () => {
    let count = 0;
    const un = mockAgentProvider.subscribe("s1", () => {
      count += 1;
      un(); // detach after the first event
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(count).toBe(1);
  });
});

describe("PermissionRequest.resolve + grant axis (Phase 1, §3)", () => {
  it("persists a session grant through the broker return channel", async () => {
    const axis = await mockAgentProvider.resolvePermission("s1", "s1-p1", { axis: "session" });
    expect(axis).toBe("session");
    expect(grantOf("s1", "s1-p1")).toBe("session");
  });

  it("a once grant is single-shot — never persisted", async () => {
    const axis = await mockAgentProvider.resolvePermission("s3", "s3-p1", { axis: "once" });
    expect(axis).toBe("once");
    expect(grantOf("s3", "s3-p1")).toBeUndefined();
  });

  it("a deny is recorded as deny (no forever-grant value exists in the type)", async () => {
    const axis = await mockAgentProvider.resolvePermission("s1", "deny-test", { axis: "deny" });
    expect(axis).toBe("deny");
    expect(grantOf("s1", "deny-test")).toBe("deny");
  });

  it("the untrusted-derived permission is flagged for a hard gate (lethal trifecta §3.3)", async () => {
    const pending = await mockAgentProvider.getPendingPermission("s3");
    expect(pending?.fromUntrusted).toBe(true);
  });
});

describe("structured telemetry aggregates parent ← subagent (Phase 1)", () => {
  it("rolls subagent tokens up into the parent total", () => {
    const total = aggregateTelemetry({ tokensIn: 0, tokensOut: 6500, runtimeMs: 169_000 }, [
      { telemetry: { tokensIn: 0, tokensOut: 1200, runtimeMs: 31_000 } },
    ]);
    expect(total.tokensOut).toBe(7700);
    // Runtime is wall-clock — the parent's, not the sum.
    expect(total.runtimeMs).toBe(169_000);
  });

  it("session telemetry is a structured shape, not a pre-rendered string", async () => {
    const [s1] = await mockAgentProvider.listSessions();
    expect(typeof s1.telemetry.tokensOut).toBe("number");
    expect(s1.telemetry.tokensOut).toBe(7700); // includes the subagent
  });
});

describe("retry-as-branch session tree (Phase 2, §2.2)", () => {
  it("a branch forks a sibling and never overwrites the parent", async () => {
    const before = await mockAgentProvider.getTree("s2");
    const parentId = before.roots[0];
    const childCountBefore = before.nodes[parentId].children.length;

    const leaf = await mockAgentProvider.branch("s2", parentId, "retry · GPT-5");
    const after = await mockAgentProvider.getTree("s2");

    // Parent still exists with its original block; a new sibling was appended.
    expect(after.nodes[parentId].block).toEqual(before.nodes[parentId].block);
    expect(after.nodes[parentId].children.length).toBe(childCountBefore + 1);
    expect(after.nodes[leaf].parentId).toBe(parentId);
    expect(after.nodes[leaf].branchLabel).toBe("retry · GPT-5");
    expect(after.activeLeaf).toBe(leaf);
  });
});

describe("Repo ≠ Worktree split (Phase 1, §2.1)", () => {
  it("a repo carries remote + default branch; a worktree carries path/branch/base", async () => {
    const repos = await mockWorkspaceProvider.listRepos();
    const worktrees = await mockWorkspaceProvider.listWorktrees();
    const core = repos.find((r) => r.id === "core")!;
    expect(core.defaultBranch).toBe("main");
    expect(core.remote).toContain("capisco/core");

    const coreWt = worktrees.find((w) => w.repoId === "core")!;
    expect(coreWt.branch).toBe("feat/worktree-teardown");
    expect(coreWt.base).toBe("main");
    expect(coreWt.path).toBe("~/dev/capisco/core");
  });

  it("every worktree points at a real repo (referential integrity)", () => {
    const repoIds = new Set(mockRepos.map((r) => r.id));
    expect(mockWorktrees.every((w) => repoIds.has(w.repoId))).toBe(true);
  });
});

describe("Datasource.readonly is a derived, non-settable invariant (Phase 2, §3.3)", () => {
  it("readonly equals env===production and is frozen", () => {
    const prod = makeDatasource({
      name: "prod",
      engine: "postgres",
      env: "production",
      tables: ["users"],
    });
    expect(prod.readonly).toBe(true);
    expect(Object.isFrozen(prod)).toBe(true);
    // The field cannot be reassigned at runtime (the invariant holds).
    expect(() => {
      // @ts-expect-error readonly is a TS-readonly derived field — assignment is rejected.
      prod.readonly = false;
    }).toThrow();
    expect(prod.readonly).toBe(true);
  });

  it("non-production is never read-only; no toggle path exists", () => {
    const staging = makeDatasource({ name: "s", engine: "pg", env: "staging", tables: [] });
    const local = makeDatasource({ name: "l", engine: "pg", env: "local", tables: [] });
    expect(staging.readonly).toBe(false);
    expect(local.readonly).toBe(false);
  });

  it("the write escape is per-command single-shot, FROZEN — no session-wide form", () => {
    const escape = makeWriteEscape("prod", "UPDATE users SET ...");
    expect(escape.consumed).toBe(false);
    // S3 — the escape is frozen: a holder cannot reset `consumed` to replay a
    // prod write. Consumption is tracked by the broker registry (keyed on `id`),
    // not by this flag. There is no "remember" / scope field.
    expect(Object.isFrozen(escape)).toBe(true);
    expect(() => {
      (escape as { consumed: boolean }).consumed = true;
    }).toThrow();
    expect(escape.consumed).toBe(false);
    expect(Object.keys(escape).sort()).toEqual(["command", "consumed", "datasource", "id"]);
  });
});

describe("History-2 shadow store (Phase 2, §5.1)", () => {
  it("is append-only and recovers any prior state", async () => {
    const store = createInMemoryShadowStore();
    const a = await store.record("f.ts", "v1", "save");
    const b = await store.record("f.ts", "v2", "external");
    await store.record("f.ts", "v3", "save");

    const list = await store.list("f.ts");
    expect(list.map((s) => s.content)).toEqual(["v1", "v2", "v3"]); // append order, nothing lost
    expect(list[1].reason).toBe("external");

    // The rescue path: restore an earlier snapshot's content.
    expect(await store.restore(a.id)).toBe("v1");
    expect(await store.restore(b.id)).toBe("v2");
    expect(await store.restore("missing")).toBeNull();
  });

  it("the seeded store mirrors the save → external → save rescue timeline", async () => {
    const list = await mockShadowStore.list("broker.ts");
    expect(list.map((s) => s.reason)).toEqual(["save", "external", "save"]);
  });
});

describe("WorkspaceProvider async surface (Phase 0)", () => {
  it("resolves the deterministic workspace data", async () => {
    expect((await mockWorkspaceProvider.getCurrentBranch())).toBe("feat/worktree-teardown");
    expect((await mockWorkspaceProvider.getStructure("broker.ts")).length).toBe(8);
    expect((await mockWorkspaceProvider.getChangeSet()).hasPullRequest).toBe(true);
  });
});
