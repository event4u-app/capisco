import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RealGitProvider } from "../git/real-git-provider.ts";
import { RealWorkspaceProvider } from "../git/real-workspace-provider.ts";
import { makeTempRepo, type TempRepo } from "./git-temp-repo.ts";

let repo: TempRepo;
let ws: RealWorkspaceProvider;

beforeEach(() => {
  repo = makeTempRepo();
  ws = new RealWorkspaceProvider({
    cwd: repo.dir,
    git: new RealGitProvider(),
    repoId: "core",
    repoName: "capisco-core",
  });
});

afterEach(() => {
  repo.cleanup();
});

describe("RealWorkspaceProvider — projects real git into UI contract shapes", () => {
  it("listRepos surfaces the repo with its current branch as default", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("init");
    const repos = await ws.listRepos();
    expect(repos).toHaveLength(1);
    expect(repos[0]).toMatchObject({ id: "core", name: "capisco-core", defaultBranch: "main" });
  });

  it("listWorktrees maps status entries to FileNode markers", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("init");
    repo.write("a.txt", "1\n2\n");
    repo.write("new.ts", "x\n");
    const [wt] = await ws.listWorktrees();
    expect(wt.path).toBe(repo.dir);
    expect(wt.branch).toBe("main");
    const a = wt.files.find((f) => f.name === "a.txt");
    const n = wt.files.find((f) => f.name === "new.ts");
    expect(a?.git).toBe("M");
    expect(n?.git).toBe("A"); // untracked → A marker
  });

  it("getCurrentBranch reflects checkout", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("init");
    repo.git(["checkout", "-q", "-b", "feature/x"]);
    expect(await ws.getCurrentBranch()).toBe("feature/x");
  });

  it("getDiff projects a unified diff into a side-by-side DiffDoc", async () => {
    repo.write("a.txt", "l1\nl2\nl3\n");
    repo.commitAll("init");
    repo.write("a.txt", "l1\nCHANGED\nl3\nl4\n");
    const doc = await ws.getDiff("a.txt");
    expect(doc.file).toBe("a.txt");
    expect(doc.added).toBe(2);
    expect(doc.removed).toBe(1);
    // del row has only a left side; add row only a right side; ctx has both.
    const del = doc.rows.find((r) => r.k === "del");
    const add = doc.rows.find((r) => r.k === "add");
    const ctx = doc.rows.find((r) => r.k === "ctx");
    expect(del?.l?.t).toBe("l2");
    expect(del?.r).toBeNull();
    expect(add?.r?.t).toBe("CHANGED");
    expect(add?.l).toBeNull();
    expect(ctx?.l).not.toBeNull();
    expect(ctx?.r).not.toBeNull();
  });

  it("getDiff on a clean repo returns an empty doc (no throw)", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("init");
    const doc = await ws.getDiff("a.txt");
    expect(doc.rows).toEqual([]);
    expect(doc.added).toBe(0);
  });

  it("getChangeSet lists changed files + real branches", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("init");
    repo.git(["branch", "develop"]);
    repo.write("a.txt", "1\n2\n");
    const cs = await ws.getChangeSet();
    expect(cs.hasPullRequest).toBe(false);
    expect(cs.files.map((f) => f.name)).toContain("a.txt");
    expect(cs.files[0].added).toBe(1);
    expect(cs.branches.map((b) => b.name).sort()).toEqual(["develop", "main"]);
    expect(cs.branches.find((b) => b.name === "main")?.role).toBe("parent");
  });

  it("getWorkStash groups local changes under the current branch", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("init");
    repo.write("a.txt", "1\n2\n");
    repo.write("b.ts", "x\n");
    const stash = await ws.getWorkStash();
    expect(stash.commitBranch).toBe("main");
    expect(stash.groups).toHaveLength(1);
    expect(stash.groups[0].files.map((f) => f.name).sort()).toEqual(["a.txt", "b.ts"]);
    expect(stash.shelf).toEqual([]);
  });

  it("getWorkStash on a clean repo has no groups", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("init");
    const stash = await ws.getWorkStash();
    expect(stash.groups).toEqual([]);
  });

  it("search + structure are honest empties under B1 scope", async () => {
    expect(await ws.getSearch()).toEqual({ query: "", files: [] });
    expect(await ws.getStructure()).toEqual([]);
    expect(await ws.listScratches()).toEqual([]);
  });
});
