import { describe, expect, it } from "vitest";
import {
  parseDiff,
  parseLog,
  parsePorcelainBlame,
  parseStatus,
} from "../git/git-parse.ts";

describe("parseStatus (porcelain v2)", () => {
  it("parses branch headers + ahead/behind", () => {
    const out = [
      "# branch.oid abc123",
      "# branch.head feature/x",
      "# branch.upstream origin/feature/x",
      "# branch.ab +3 -1",
    ].join("\n");
    const s = parseStatus(out);
    expect(s.branch).toBe("feature/x");
    expect(s.upstream).toBe("origin/feature/x");
    expect(s.ahead).toBe(3);
    expect(s.behind).toBe(1);
    expect(s.clean).toBe(true);
  });

  it("parses an ordinary modified entry (1 .M)", () => {
    const out = [
      "# branch.head main",
      "1 .M N... 100644 100644 100644 1111 2222 src/a.ts",
    ].join("\n");
    const s = parseStatus(out);
    expect(s.entries).toHaveLength(1);
    expect(s.entries[0]).toEqual({ path: "src/a.ts", staged: ".", unstaged: "M" });
  });

  it("parses a staged add (1 A.)", () => {
    const out = ["# branch.head main", "1 A. N... 0 100644 100644 0000 3333 new.ts"].join("\n");
    const s = parseStatus(out);
    expect(s.entries[0]).toEqual({ path: "new.ts", staged: "A", unstaged: "." });
  });

  it("parses a rename entry (2 R.) with orig path", () => {
    const out = [
      "# branch.head main",
      "2 R. N... 100644 100644 100644 1111 2222 R100 new/name.ts\told/name.ts",
    ].join("\n");
    const s = parseStatus(out);
    expect(s.entries[0].path).toBe("new/name.ts");
    expect(s.entries[0].origPath).toBe("old/name.ts");
    expect(s.entries[0].staged).toBe("R");
  });

  it("parses untracked + ignored", () => {
    const out = ["# branch.head main", "? untracked.txt", "! ignored.log"].join("\n");
    const s = parseStatus(out);
    const u = s.entries.find((e) => e.path === "untracked.txt");
    const i = s.entries.find((e) => e.path === "ignored.log");
    expect(u?.unstaged).toBe("?");
    expect(i?.unstaged).toBe("!");
  });

  it("detached HEAD falls back to the marker", () => {
    const s = parseStatus("# branch.head (detached)\n");
    expect(s.branch).toBe("(detached)");
  });
});

describe("parseDiff (unified patch + numstat)", () => {
  const numstat = "2\t1\tsrc/a.ts\n";
  const patch = [
    "diff --git a/src/a.ts b/src/a.ts",
    "index 111..222 100644",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,3 +1,4 @@",
    " line1",
    "-line2",
    "+CHANGED",
    " line3",
    "+line4",
    "",
  ].join("\n");

  it("parses a single modified file with hunks + counts", () => {
    const files = parseDiff(patch, numstat);
    expect(files).toHaveLength(1);
    const f = files[0];
    expect(f.path).toBe("src/a.ts");
    expect(f.status).toBe("M");
    expect(f.added).toBe(2);
    expect(f.removed).toBe(1);
    expect(f.hunks).toHaveLength(1);
    expect(f.hunks[0].oldStart).toBe(1);
    expect(f.hunks[0].newLines).toBe(4);
    expect(f.hunks[0].lines).toEqual([" line1", "-line2", "+CHANGED", " line3", "+line4"]);
  });

  it("flags an added file (new file mode)", () => {
    const p = [
      "diff --git a/new.ts b/new.ts",
      "new file mode 100644",
      "index 0000..111",
      "--- /dev/null",
      "+++ b/new.ts",
      "@@ -0,0 +1,1 @@",
      "+hello",
      "",
    ].join("\n");
    const files = parseDiff(p, "1\t0\tnew.ts\n");
    expect(files[0].status).toBe("A");
    expect(files[0].added).toBe(1);
  });

  it("flags a binary file with no hunks", () => {
    const p = [
      "diff --git a/img.png b/img.png",
      "index 111..222 100644",
      "Binary files a/img.png and b/img.png differ",
      "",
    ].join("\n");
    const files = parseDiff(p, "-\t-\timg.png\n");
    expect(files[0].binary).toBe(true);
    expect(files[0].hunks).toEqual([]);
  });

  it("parses two files in one patch", () => {
    const p = patch + [
      "diff --git a/b.ts b/b.ts",
      "index 333..444 100644",
      "--- a/b.ts",
      "+++ b/b.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "",
    ].join("\n");
    const files = parseDiff(p, numstat + "1\t1\tb.ts\n");
    expect(files.map((f) => f.path)).toEqual(["src/a.ts", "b.ts"]);
  });
});

describe("parseLog (NUL fields / RS records)", () => {
  const NUL = "\x00";
  const RS = "\x1e";
  it("parses commits with parents", () => {
    const rec = (fields: string[]): string => fields.join(NUL) + RS;
    const out =
      rec(["hash2", "h2", "Bot", "bot@x", "1700000100", "hash1", "second"]) +
      "\n" +
      rec(["hash1", "h1", "Bot", "bot@x", "1700000000", "", "first"]);
    const log = parseLog(out);
    expect(log).toHaveLength(2);
    expect(log[0].subject).toBe("second");
    expect(log[0].parents).toEqual(["hash1"]);
    expect(log[1].parents).toEqual([]);
    expect(log[0].author).toBe("Bot");
    expect(log[0].date).toBe("1700000100");
  });

  it("tolerates a subject containing a NUL-safe arrow / unicode", () => {
    const out = ["h", "h", "A", "a@x", "1", "", "feat: ↓3 ahead"].join(NUL) + RS;
    expect(parseLog(out)[0].subject).toBe("feat: ↓3 ahead");
  });

  it("empty output yields no commits", () => {
    expect(parseLog("")).toEqual([]);
  });
});

describe("parsePorcelainBlame", () => {
  it("attributes each content line to its commit", () => {
    const h1 = "a".repeat(40);
    const h2 = "b".repeat(40);
    const out = [
      `${h1} 1 1 1`,
      "author Alice",
      "author-time 1700000000",
      "\talpha",
      `${h2} 2 2 1`,
      "author Bob",
      "author-time 1700000100",
      "\tbeta",
    ].join("\n");
    const blame = parsePorcelainBlame(out);
    expect(blame).toHaveLength(2);
    expect(blame[0]).toMatchObject({ author: "Alice", content: "alpha", lineNo: 1, shortHash: "aaaaaaa" });
    expect(blame[1]).toMatchObject({ author: "Bob", content: "beta", lineNo: 2 });
  });

  it("reuses commit headers emitted once for multi-line commits", () => {
    const h1 = "c".repeat(40);
    const out = [
      `${h1} 1 1 2`,
      "author Carol",
      "author-time 1700000000",
      "\tone",
      `${h1} 2 2`,
      "\ttwo",
    ].join("\n");
    const blame = parsePorcelainBlame(out);
    expect(blame).toHaveLength(2);
    expect(blame[0].author).toBe("Carol");
    expect(blame[1].author).toBe("Carol");
    expect(blame[1].content).toBe("two");
  });
});
