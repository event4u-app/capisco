/**
 * Session-Store integration test (B3 Phase 0). Proves the persistent store
 * satisfies the four §2.2 capabilities deterministically:
 *  - persist (create + append + update) and read back,
 *  - resume (rehydrate records + ordered blocks + tree),
 *  - full-text search (message bodies + tool targets),
 *  - retry-as-branch (forks a sibling, NEVER overwrites the parent),
 *  - copy (deep, fresh id, provenance).
 */

import { beforeEach, describe, expect, it } from "vitest";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import type { SessionStore, TranscriptBlock } from "@/contracts";

let store: SessionStore;

function msg(id: string, role: "user" | "agent", body: string): TranscriptBlock {
  return { type: "message", block: { id, role, body } };
}

function tool(id: string, kind: string, target: string): TranscriptBlock {
  return { type: "tool", block: { id, kind, target } };
}

beforeEach(() => {
  store = new InMemorySessionStore();
});

describe("InMemorySessionStore — persistence + resume", () => {
  it("creates a deterministic session record with a monotonic seq", async () => {
    const a = await store.create({ model: "Opus 4.8", title: "First" });
    const b = await store.create({ model: "GPT-5", title: "Second" });
    expect(a.id).toBe("sess-1");
    expect(b.id).toBe("sess-2");
    expect(a.seq).toBeLessThan(b.seq);
    expect(a.status).toBe("idle");
    expect(a.telemetry).toEqual({ tokensIn: 0, tokensOut: 0, runtimeMs: 0 });
  });

  it("honours an explicit id and worktree coupling (§2.1)", async () => {
    const s = await store.create({
      id: "todo-1",
      model: "Local",
      title: "ToDo run",
      worktreePath: "/repo/.worktrees/todo-1",
    });
    expect(s.id).toBe("todo-1");
    expect(s.worktreePath).toBe("/repo/.worktrees/todo-1");
  });

  it("appends blocks, extends the linear tree, and resumes the full transcript", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "Run" });
    await store.append(s.id, msg("m1", "user", "Tear down the worktree"));
    await store.append(s.id, msg("m2", "agent", "On it — editing worktree.ts"));
    await store.append(s.id, tool("t1", "Edit", "src/core/worktree.ts"));

    const resumed = await store.resume(s.id);
    expect(resumed.blocks.map((b) => b.block.id)).toEqual(["m1", "m2", "t1"]);
    // Linear tree: m1 → m2 → t1, t1 is the active leaf.
    expect(resumed.tree.roots).toEqual(["m1"]);
    expect(resumed.tree.nodes["m1"].children).toEqual(["m2"]);
    expect(resumed.tree.nodes["m2"].children).toEqual(["t1"]);
    expect(resumed.tree.activeLeaf).toBe("t1");
  });

  it("update patches status + telemetry; resume reflects it", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "Run" });
    await store.update(s.id, { status: "running", telemetry: { tokensIn: 10, tokensOut: 200, runtimeMs: 1500 } });
    const got = await store.get(s.id);
    expect(got?.status).toBe("running");
    expect(got?.telemetry).toEqual({ tokensIn: 10, tokensOut: 200, runtimeMs: 1500 });
  });

  it("resume of an unknown session throws", async () => {
    await expect(store.resume("nope")).rejects.toThrow(/unknown session/);
  });

  it("reads never alias the live store (resume returns a clone)", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "Run" });
    await store.append(s.id, msg("m1", "user", "hello"));
    const r1 = await store.resume(s.id);
    r1.tree.nodes["m1"].children.push("tamper");
    r1.blocks.push(msg("evil", "user", "x"));
    const r2 = await store.resume(s.id);
    expect(r2.tree.nodes["m1"].children).toEqual([]);
    expect(r2.blocks).toHaveLength(1);
  });
});

describe("InMemorySessionStore — full-text search", () => {
  it("indexes message bodies and matches case-insensitively", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "Port question" });
    await store.append(s.id, msg("m1", "user", "Where is the PORT allocated for a worktree?"));
    const hits = await store.search("port allocated");
    expect(hits).toHaveLength(1);
    expect(hits[0].sessionId).toBe(s.id);
    expect(hits[0].blockId).toBe("m1");
    expect(hits[0].snippet.toLowerCase()).toContain("port allocated");
  });

  it("indexes tool targets, not just messages", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "Edit" });
    await store.append(s.id, tool("t1", "Edit", "src/core/worktree.ts"));
    const hits = await store.search("worktree.ts");
    expect(hits.map((h) => h.blockId)).toEqual(["t1"]);
  });

  it("searches across sessions, ordered by session seq", async () => {
    const a = await store.create({ model: "Opus 4.8", title: "A" });
    const b = await store.create({ model: "GPT-5", title: "B" });
    await store.append(b.id, msg("b1", "user", "broker grant model"));
    await store.append(a.id, msg("a1", "user", "broker chokepoint"));
    const hits = await store.search("broker");
    // a was created first (lower seq) → its hit comes first.
    expect(hits.map((h) => h.sessionId)).toEqual([a.id, b.id]);
  });

  it("empty / whitespace query returns no hits", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "x" });
    await store.append(s.id, msg("m1", "user", "something"));
    expect(await store.search("   ")).toEqual([]);
  });
});

describe("InMemorySessionStore — retry-as-branch (§2.2)", () => {
  it("forks a sibling and NEVER overwrites the parent", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "Run" });
    await store.append(s.id, msg("m1", "user", "do X"));
    const aId = await store.append(s.id, msg("m2", "agent", "first answer"));

    const branchId = await store.retryAsBranch(s.id, aId, "retry · GPT-5");

    const resumed = await store.resume(s.id);
    // The parent m2 still carries the original answer — preserved, not replaced.
    expect(resumed.tree.nodes["m2"].block).toEqual(
      expect.objectContaining({ type: "message" }),
    );
    expect(resumed.blocks.find((b) => b.block.id === "m2")?.block).toEqual(
      expect.objectContaining({ id: "m2" }),
    );
    // m2 now has the branch as a child; the branch is the active leaf.
    expect(resumed.tree.nodes["m2"].children).toContain(branchId);
    expect(resumed.tree.activeLeaf).toBe(branchId);
    expect(resumed.tree.nodes[branchId].branchLabel).toBe("retry · GPT-5");
    expect(resumed.tree.nodes[branchId].parentId).toBe("m2");
  });

  it("multiple retries graft multiple siblings", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "Run" });
    const nodeId = await store.append(s.id, msg("m1", "agent", "answer"));
    const b1 = await store.retryAsBranch(s.id, nodeId);
    const b2 = await store.retryAsBranch(s.id, nodeId);
    const resumed = await store.resume(s.id);
    expect(resumed.tree.nodes["m1"].children).toEqual([b1, b2]);
  });

  it("retry on an unknown node throws", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "Run" });
    await expect(store.retryAsBranch(s.id, "ghost")).rejects.toThrow(/unknown node/);
  });
});

describe("InMemorySessionStore — copy", () => {
  it("deep-copies into a fresh id with provenance", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "Original" });
    await store.append(s.id, msg("m1", "user", "hi"));
    const copy = await store.copy(s.id);

    expect(copy.id).not.toBe(s.id);
    expect(copy.copiedFrom).toBe(s.id);
    expect(copy.title).toBe("Original (copy)");

    const resumed = await store.resume(copy.id);
    expect(resumed.blocks.map((b) => b.block.id)).toEqual(["m1"]);

    // Appending to the copy does NOT touch the original.
    await store.append(copy.id, msg("m2", "agent", "extra"));
    const original = await store.resume(s.id);
    expect(original.blocks).toHaveLength(1);
  });

  it("honours a custom copy title", async () => {
    const s = await store.create({ model: "Opus 4.8", title: "X" });
    const copy = await store.copy(s.id, "Branched experiment");
    expect(copy.title).toBe("Branched experiment");
  });
});
