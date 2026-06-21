import { describe, expect, it } from "vitest";
import { parseEslint, parseTsc, parseVitest } from "../quality/quality-parse.ts";

const CWD = "/work/repo";

describe("parseEslint", () => {
  const stdout = JSON.stringify([
    {
      filePath: "/work/repo/sample.js",
      messages: [
        {
          ruleId: "prefer-const",
          severity: 2,
          message: "'x' is never reassigned. Use 'const' instead.",
          line: 1,
          column: 5,
          fix: { range: [0, 10], text: "const x = 1;" },
        },
        {
          ruleId: "no-unused-vars",
          severity: 1,
          message: "'unused' is assigned a value but never used.",
          line: 3,
          column: 5,
        },
      ],
    },
  ]);

  it("parses errors + warnings with line/column/rule", () => {
    const diags = parseEslint(CWD, stdout);
    expect(diags).toHaveLength(2);
    expect(diags[0]).toMatchObject({
      tool: "eslint",
      file: "sample.js",
      line: 1,
      column: 5,
      severity: "error",
      rule: "prefer-const",
    });
    expect(diags[1].severity).toBe("warning");
  });

  it("surfaces an applicable auto-fix when eslint reports one", () => {
    const diags = parseEslint(CWD, stdout);
    expect(diags[0].fix).toMatchObject({ autoApplicable: true, ruleId: "prefer-const" });
    // The warning had no fix block → no fix surfaced.
    expect(diags[1].fix).toBeUndefined();
  });

  it("returns [] for empty or junk output", () => {
    expect(parseEslint(CWD, "")).toEqual([]);
    expect(parseEslint(CWD, "not json")).toEqual([]);
  });
});

describe("parseTsc", () => {
  it("parses `file(line,col): error TSxxxx: message`", () => {
    const stdout = 'bad.ts(1,14): error TS2322: Type \'string\' is not assignable to type \'number\'.\n';
    const diags = parseTsc(CWD, stdout);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      tool: "tsc",
      file: "bad.ts",
      line: 1,
      column: 14,
      severity: "error",
      rule: "TS2322",
    });
    expect(diags[0].message).toContain("not assignable");
  });

  it("makes absolute paths worktree-relative", () => {
    const stdout = "/work/repo/src/a.ts(5,2): error TS1005: ';' expected.\n";
    expect(parseTsc(CWD, stdout)[0].file).toBe("src/a.ts");
  });

  it("ignores non-diagnostic lines", () => {
    expect(parseTsc(CWD, "Found 0 errors.\n\n")).toEqual([]);
  });
});

describe("parseVitest", () => {
  const stdout = JSON.stringify({
    testResults: [
      {
        name: "/work/repo/sum.test.js",
        assertionResults: [
          { fullName: "adds correctly", status: "passed", failureMessages: [] },
          {
            fullName: "fails on purpose",
            status: "failed",
            failureMessages: [
              "AssertionError: expected 3 to be 4 // Object.is equality\n    at /work/repo/sum.test.js:4:52\n    at /work/repo/node_modules/x.js:1:1",
            ],
          },
        ],
      },
    ],
  });

  it("emits one error diagnostic per failing assertion, none for passing", () => {
    const diags = parseVitest(CWD, stdout);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      tool: "vitest",
      file: "sum.test.js",
      line: 4,
      column: 52,
      severity: "error",
      rule: "fails on purpose",
    });
    expect(diags[0].message).toContain("expected 3 to be 4");
  });

  it("skips node_modules frames when attaching the location", () => {
    expect(parseVitest(CWD, stdout)[0].file).toBe("sum.test.js");
  });

  it("returns [] for empty or junk output", () => {
    expect(parseVitest(CWD, "")).toEqual([]);
    expect(parseVitest(CWD, "{not json")).toEqual([]);
  });
});
