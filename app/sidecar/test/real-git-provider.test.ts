import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RealGitProvider } from "../git/real-git-provider.ts";
import { makeTempRepo, TEMP_AUTHOR, type TempRepo } from "./git-temp-repo.ts";

let repo: TempRepo;
let g: RealGitProvider;

beforeEach(() => {
  repo = makeTempRepo();
  g = new RealGitProvider();
});

afterEach(() => {
  repo.cleanup();
});

describe("RealGitProvider — read", () => {
  it("detects a git work tree", async () => {
    expect(await g.isRepo(repo.dir)).toBe(true);
  });

  it("reports a non-repo dir as not a repo", async () => {
    // The OS temp root is not itself a git repo.
    const { tmpdir } = await import("node:os");
    expect(await g.isRepo(tmpdir())).toBe(false);
  });

  it("status: empty repo is clean on main", async () => {
    const s = await g.status(repo.dir);
    expect(s.branch).toBe("main");
    expect(s.clean).toBe(true);
    expect(s.entries).toEqual([]);
  });

  it("status: untracked file shows as ?", async () => {
    repo.write("a.txt", "hello\n");
    const s = await g.status(repo.dir);
    expect(s.clean).toBe(false);
    const e = s.entries.find((x) => x.path === "a.txt");
    expect(e).toBeDefined();
    expect(e?.unstaged).toBe("?");
  });

  it("status: staged add shows on the index column", async () => {
    repo.write("a.txt", "hello\n");
    await g.stage(repo.dir, ["a.txt"]);
    const s = await g.status(repo.dir);
    const e = s.entries.find((x) => x.path === "a.txt");
    expect(e?.staged).toBe("A");
  });

  it("status: modified tracked file shows on the worktree column", async () => {
    repo.write("a.txt", "hello\n");
    repo.commitAll("init");
    repo.write("a.txt", "hello\nworld\n");
    const s = await g.status(repo.dir);
    const e = s.entries.find((x) => x.path === "a.txt");
    expect(e?.unstaged).toBe("M");
  });

  it("status: ahead/behind parsed when an upstream exists", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("c1");
    // Create a fake upstream by branching and setting tracking.
    repo.git(["branch", "upstream"]);
    repo.git(["branch", "--set-upstream-to=upstream", "main"]);
    repo.write("a.txt", "1\n2\n");
    repo.commitAll("c2");
    const s = await g.status(repo.dir);
    expect(s.upstream).toBe("upstream");
    expect(s.ahead).toBe(1);
    expect(s.behind).toBe(0);
  });

  it("diff: working-tree changes carry hunks + counts", async () => {
    repo.write("a.txt", "line1\nline2\nline3\n");
    repo.commitAll("init");
    repo.write("a.txt", "line1\nCHANGED\nline3\nline4\n");
    const diffs = await g.diff(repo.dir);
    expect(diffs).toHaveLength(1);
    const d = diffs[0];
    expect(d.path).toBe("a.txt");
    expect(d.added).toBe(2);
    expect(d.removed).toBe(1);
    expect(d.hunks.length).toBeGreaterThan(0);
    expect(d.hunks[0].lines.some((l) => l.startsWith("+CHANGED"))).toBe(true);
    expect(d.hunks[0].lines.some((l) => l.startsWith("-line2"))).toBe(true);
  });

  it("diff: staged-only changes via { staged: true }", async () => {
    repo.write("a.txt", "x\n");
    repo.commitAll("init");
    repo.write("a.txt", "x\ny\n");
    await g.stage(repo.dir, ["a.txt"]);
    const staged = await g.diff(repo.dir, { staged: true });
    expect(staged).toHaveLength(1);
    expect(staged[0].added).toBe(1);
    // Working tree now matches index → no unstaged diff.
    const working = await g.diff(repo.dir);
    expect(working).toHaveLength(0);
  });

  it("diff: branch-vs-base compares against a ref", async () => {
    repo.write("a.txt", "base\n");
    repo.commitAll("base");
    repo.git(["checkout", "-q", "-b", "feature"]);
    repo.write("a.txt", "base\nfeature\n");
    repo.commitAll("feature work");
    const diffs = await g.diff(repo.dir, { base: "main" });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].added).toBe(1);
  });

  it("log: returns commits newest-first with parents", async () => {
    repo.write("a.txt", "1\n");
    const c1 = repo.commitAll("first");
    repo.write("a.txt", "1\n2\n");
    const c2 = repo.commitAll("second");
    const log = await g.log(repo.dir);
    expect(log).toHaveLength(2);
    expect(log[0].subject).toBe("second");
    expect(log[0].shortHash).toBe(c2);
    expect(log[1].subject).toBe("first");
    expect(log[1].shortHash).toBe(c1);
    expect(log[0].parents).toHaveLength(1);
    expect(log[1].parents).toHaveLength(0);
    expect(log[0].author).toBe(TEMP_AUTHOR.name);
  });

  it("log: honours limit and path filters", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("a1");
    repo.write("b.txt", "1\n");
    repo.commitAll("b1");
    repo.write("a.txt", "1\n2\n");
    repo.commitAll("a2");
    expect(await g.log(repo.dir, { limit: 1 })).toHaveLength(1);
    const aLog = await g.log(repo.dir, { path: "a.txt" });
    expect(aLog.map((c) => c.subject)).toEqual(["a2", "a1"]);
  });

  it("log: empty repo yields no commits (no throw)", async () => {
    expect(await g.log(repo.dir)).toEqual([]);
  });

  it("blame: attributes each line to its commit", async () => {
    repo.write("a.txt", "alpha\n");
    const c1 = repo.commitAll("add alpha");
    repo.write("a.txt", "alpha\nbeta\n");
    const c2 = repo.commitAll("add beta");
    const blame = await g.blame(repo.dir, "a.txt");
    expect(blame).toHaveLength(2);
    expect(blame[0].content).toBe("alpha");
    expect(blame[0].shortHash).toBe(c1);
    expect(blame[1].content).toBe("beta");
    expect(blame[1].shortHash).toBe(c2);
    expect(blame[0].author).toBe(TEMP_AUTHOR.name);
    expect(blame[1].lineNo).toBe(2);
  });

  it("branches: lists locals, marks current", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("init");
    repo.git(["branch", "feature"]);
    const branches = await g.branches(repo.dir);
    const names = branches.map((b) => b.name).sort();
    expect(names).toEqual(["feature", "main"]);
    expect(branches.find((b) => b.name === "main")?.current).toBe(true);
    expect(branches.find((b) => b.name === "feature")?.current).toBe(false);
  });

  it("currentBranch reflects checkout", async () => {
    repo.write("a.txt", "1\n");
    repo.commitAll("init");
    expect(await g.currentBranch(repo.dir)).toBe("main");
    repo.git(["checkout", "-q", "-b", "feature"]);
    expect(await g.currentBranch(repo.dir)).toBe("feature");
  });
});

describe("RealGitProvider — write", () => {
  it("stage + commit lands a commit", async () => {
    repo.write("a.txt", "hello\n");
    await g.stage(repo.dir, ["a.txt"]);
    const res = await g.commit(repo.dir, "first commit", TEMP_AUTHOR);
    expect(res.ok).toBe(true);
    const log = await g.log(repo.dir);
    expect(log).toHaveLength(1);
    expect(log[0].subject).toBe("first commit");
    expect(log[0].shortHash).toBe(res.ref);
    expect(log[0].author).toBe(TEMP_AUTHOR.name);
  });

  it("stage([]) stages everything", async () => {
    repo.write("a.txt", "a\n");
    repo.write("b.txt", "b\n");
    await g.stage(repo.dir, []);
    const s = await g.status(repo.dir);
    expect(s.entries.every((e) => e.staged === "A")).toBe(true);
    expect(s.entries).toHaveLength(2);
  });

  it("unstage moves a staged file back to the worktree", async () => {
    repo.write("a.txt", "a\n");
    repo.commitAll("init");
    repo.write("a.txt", "a\nb\n");
    await g.stage(repo.dir, ["a.txt"]);
    expect((await g.status(repo.dir)).entries[0].staged).toBe("M");
    await g.unstage(repo.dir, ["a.txt"]);
    const s = await g.status(repo.dir);
    expect(s.entries[0].staged).toBe(".");
    expect(s.entries[0].unstaged).toBe("M");
  });

  it("unstage on an unborn branch resets the index", async () => {
    repo.write("a.txt", "a\n");
    await g.stage(repo.dir, ["a.txt"]);
    await g.unstage(repo.dir, ["a.txt"]);
    const s = await g.status(repo.dir);
    expect(s.entries[0].unstaged).toBe("?");
  });

  it("branchCreate makes a branch without switching", async () => {
    repo.write("a.txt", "a\n");
    repo.commitAll("init");
    const res = await g.branchCreate(repo.dir, "feature");
    expect(res.ref).toBe("feature");
    expect(await g.currentBranch(repo.dir)).toBe("main");
    expect((await g.branches(repo.dir)).some((b) => b.name === "feature")).toBe(true);
  });

  it("branchCreate from a base ref", async () => {
    repo.write("a.txt", "a\n");
    repo.commitAll("c1");
    const tip = (await g.log(repo.dir))[0].shortHash;
    repo.write("a.txt", "a\nb\n");
    repo.commitAll("c2");
    await g.branchCreate(repo.dir, "from-c1", tip);
    // The new branch tip is c1, not c2.
    const branches = await g.branches(repo.dir);
    expect(branches.find((b) => b.name === "from-c1")?.tip).toBe(tip);
  });

  it("checkout switches branches; checkout(create) makes-and-switches", async () => {
    repo.write("a.txt", "a\n");
    repo.commitAll("init");
    repo.git(["branch", "feature"]);
    await g.checkout(repo.dir, "feature");
    expect(await g.currentBranch(repo.dir)).toBe("feature");
    await g.checkout(repo.dir, "hotfix", true);
    expect(await g.currentBranch(repo.dir)).toBe("hotfix");
  });

  it("full round-trip: init → stage → commit → branch → checkout → diff → log", async () => {
    repo.write("src/app.ts", "export const x = 1;\n");
    await g.stage(repo.dir, []);
    const c1 = await g.commit(repo.dir, "init app", TEMP_AUTHOR);
    await g.checkout(repo.dir, "feat/edit", true);
    repo.write("src/app.ts", "export const x = 2;\n");
    await g.stage(repo.dir, ["src/app.ts"]);
    const c2 = await g.commit(repo.dir, "bump x", TEMP_AUTHOR);
    expect(c2.ref).not.toBe(c1.ref);

    const branchDiff = await g.diff(repo.dir, { base: "main" });
    expect(branchDiff).toHaveLength(1);
    expect(branchDiff[0].path).toBe("src/app.ts");

    const log = await g.log(repo.dir);
    expect(log.map((l) => l.subject)).toEqual(["bump x", "init app"]);
    expect(await g.currentBranch(repo.dir)).toBe("feat/edit");
  });
});
