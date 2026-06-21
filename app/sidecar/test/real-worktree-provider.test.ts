import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { RealWorktreeProvider, parseWorktreeList } from "../git/real-worktree-provider.ts";
import { makeTempRepo, type TempRepo } from "./git-temp-repo.ts";

let repo: TempRepo;
let wt: RealWorktreeProvider;

beforeEach(() => {
  repo = makeTempRepo();
  // A worktree needs at least one commit on the main branch.
  repo.write("README.md", "# temp\n");
  repo.commitAll("init");
  wt = new RealWorktreeProvider();
});

afterEach(() => {
  repo.cleanup();
});

describe("parseWorktreeList", () => {
  it("parses the porcelain blocks (main + linked + prunable)", () => {
    const out = [
      "worktree /repo",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /repo/.worktrees/feat",
      "HEAD def456",
      "branch refs/heads/feature-x",
      "",
      "worktree /repo/.worktrees/gone",
      "HEAD 000000",
      "detached",
      "prunable gitdir file points to non-existent location",
      "",
    ].join("\n");
    const parsed = parseWorktreeList(out);
    expect(parsed).toHaveLength(3);
    expect(parsed[0]).toMatchObject({ path: "/repo", branch: "main", detached: false, prunable: false });
    expect(parsed[1]).toMatchObject({ path: "/repo/.worktrees/feat", branch: "feature-x" });
    expect(parsed[2]).toMatchObject({ path: "/repo/.worktrees/gone", detached: true, prunable: true });
    expect(parsed[2].branch).toBeUndefined();
  });
});

describe("RealWorktreeProvider — real git", () => {
  it("lists only the main worktree initially, flagged isMain", async () => {
    const list = await wt.list(repo.dir);
    expect(list).toHaveLength(1);
    expect(list[0].isMain).toBe(true);
    expect(list[0].branch).toBe("main");
    expect(list[0].sessionId).toBeUndefined();
  });

  it("creates a new worktree on a new branch, coupled to a session", async () => {
    const path = join(repo.dir, ".worktrees", "feat");
    const made = await wt.create(repo.dir, path, {
      branch: "feature-x",
      newBranch: true,
      sessionId: "sess-1",
    });
    expect(made.isMain).toBe(false);
    expect(made.branch).toBe("feature-x");
    expect(made.sessionId).toBe("sess-1");
    expect(existsSync(path)).toBe(true);

    const list = await wt.list(repo.dir);
    expect(list).toHaveLength(2);
    const linked = list.find((w) => !w.isMain);
    expect(linked?.sessionId).toBe("sess-1");
    expect(linked?.branch).toBe("feature-x");
  });

  it("creates N worktrees and lists them all with stable coupling", async () => {
    for (let i = 0; i < 3; i++) {
      await wt.create(repo.dir, join(repo.dir, ".worktrees", `w${i}`), {
        branch: `b${i}`,
        newBranch: true,
        sessionId: `sess-${i}`,
      });
    }
    const list = await wt.list(repo.dir);
    expect(list).toHaveLength(4); // main + 3
    const linked = list.filter((w) => !w.isMain);
    expect(linked.map((w) => w.sessionId).sort()).toEqual(["sess-0", "sess-1", "sess-2"]);
  });

  it("removes a worktree and drops its session coupling", async () => {
    const path = join(repo.dir, ".worktrees", "feat");
    await wt.create(repo.dir, path, { branch: "feature-x", newBranch: true, sessionId: "sess-1" });
    expect(await wt.list(repo.dir)).toHaveLength(2);

    await wt.remove(repo.dir, path);
    const list = await wt.list(repo.dir);
    expect(list).toHaveLength(1);
    expect(list[0].isMain).toBe(true);
    expect(existsSync(path)).toBe(false);
  });

  it("checks out an existing branch into a worktree (newBranch=false)", async () => {
    repo.git(["branch", "existing-branch"]);
    const path = join(repo.dir, ".worktrees", "existing");
    const made = await wt.create(repo.dir, path, { branch: "existing-branch" });
    expect(made.branch).toBe("existing-branch");
  });

  describe("GC on crash", () => {
    it("prunes a worktree whose directory vanished and releases its session", async () => {
      const path = join(repo.dir, ".worktrees", "crashed");
      await wt.create(repo.dir, path, { branch: "crash-b", newBranch: true, sessionId: "sess-crash" });
      expect(await wt.list(repo.dir)).toHaveLength(2);

      // Simulate a crash: the worktree directory is deleted out from under git
      // (git's administrative entry under .git/worktrees survives → prunable).
      rmSync(path, { recursive: true, force: true });

      const result = await wt.gc(repo.dir);
      expect(result.releasedSessions).toEqual(["sess-crash"]);
      expect(result.pruned).toHaveLength(1);
      expect(result.pruned[0]).toContain("crashed");

      // After prune, git no longer lists the dead worktree.
      const list = await wt.list(repo.dir);
      expect(list).toHaveLength(1);
      expect(list[0].isMain).toBe(true);
    });

    it("gc is idempotent and a no-op when nothing is prunable", async () => {
      const first = await wt.gc(repo.dir);
      expect(first.pruned).toEqual([]);
      expect(first.releasedSessions).toEqual([]);
      const second = await wt.gc(repo.dir);
      expect(second.pruned).toEqual([]);
    });
  });
});
