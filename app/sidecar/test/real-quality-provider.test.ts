import { afterEach, describe, expect, it } from "vitest";
import {
  RealQualityProvider,
  resultsToSignals,
  typescriptPack,
} from "../quality/real-quality-provider.ts";
import { FakeAiReviewProvider } from "../quality/fake-ai-review-provider.ts";
import {
  makeCleanEslintFixture,
  makeEslintFixture,
  makeTscFixture,
  makeVitestFixture,
  type FixtureWorktree,
} from "./quality-fixture.ts";

const provider = new RealQualityProvider();
let wt: FixtureWorktree | null = null;

afterEach(() => {
  wt?.cleanup();
  wt = null;
});

describe("RealQualityProvider — eslint against fixture files (REAL run)", () => {
  it("parses a known prefer-const error + no-unused-vars warning with a fix", async () => {
    wt = makeEslintFixture();
    const result = await provider.run(wt.dir, "eslint");
    expect(result.tool).toBe("eslint");
    expect(result.ok).toBe(false); // has an error
    const preferConst = result.diagnostics.find((d) => d.rule === "prefer-const");
    expect(preferConst).toBeDefined();
    expect(preferConst!.severity).toBe("error");
    expect(preferConst!.file).toBe("sample.js");
    expect(preferConst!.line).toBe(1);
    expect(preferConst!.fix?.autoApplicable).toBe(true);

    const unused = result.diagnostics.find((d) => d.rule === "no-unused-vars");
    expect(unused?.severity).toBe("warning");
    expect(result.runtimeMs).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it("reports clean (ok) on a fixture with no problems", async () => {
    wt = makeCleanEslintFixture();
    const result = await provider.run(wt.dir, "eslint");
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  }, 30_000);
});

describe("RealQualityProvider — tsc against fixture files (REAL run)", () => {
  it("parses a known TS2322 type error", async () => {
    wt = makeTscFixture();
    const result = await provider.run(wt.dir, "tsc", { files: ["bad.ts"] });
    expect(result.ok).toBe(false);
    const err = result.diagnostics.find((d) => d.rule === "TS2322");
    expect(err).toBeDefined();
    expect(err!.severity).toBe("error");
    expect(err!.file).toBe("bad.ts");
    expect(err!.message).toContain("not assignable");
  }, 60_000);
});

describe("RealQualityProvider — vitest against fixture files (REAL run)", () => {
  it("parses one failing assertion as an error diagnostic", async () => {
    wt = makeVitestFixture();
    const result = await provider.run(wt.dir, "vitest", { files: ["sum.test.js"] });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].tool).toBe("vitest");
    expect(result.diagnostics[0].rule).toBe("fails on purpose");
    expect(result.diagnostics[0].file).toBe("sum.test.js");
  }, 60_000);
});

describe("RealQualityProvider — availableTools + pack", () => {
  it("ships the TypeScript pack (eslint/tsc/vitest)", async () => {
    wt = makeCleanEslintFixture();
    expect(await provider.availableTools(wt.dir)).toEqual(["eslint", "tsc", "vitest"]);
    expect(typescriptPack.id).toBe("typescript");
    expect(typescriptPack.tools).toEqual(["eslint", "tsc", "vitest"]);
    expect(await typescriptPack.isAvailable(wt.dir)).toBe(true);
  });

  it("rejects an unknown tool (deferred packs are the interface, not impl)", async () => {
    wt = makeCleanEslintFixture();
    await expect(provider.run(wt.dir, "phpstan")).rejects.toThrow(/Unknown quality tool/);
  });
});

describe("toSignals — fold diagnostics onto the shared lint rail (§5.2)", () => {
  it("maps a clean result to a success lint signal", () => {
    const signals = resultsToSignals([
      { tool: "tsc", ok: true, diagnostics: [], runtimeMs: 12, exitCode: 0 },
    ]);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ source: "lint", sev: "success", id: "lint-tsc" });
    expect(signals[0].title).toContain("clean");
  });

  it("maps an error result to a warning-sev lint signal with counts + location", () => {
    const signals = resultsToSignals([
      {
        tool: "eslint",
        ok: false,
        diagnostics: [
          { tool: "eslint", file: "a.js", line: 3, severity: "error", message: "bad" },
          { tool: "eslint", file: "a.js", line: 5, severity: "warning", message: "meh" },
        ],
        runtimeMs: 20,
        exitCode: 1,
      },
    ]);
    expect(signals[0].source).toBe("lint");
    expect(signals[0].sev).toBe("warning");
    expect(signals[0].sub).toContain("1 error");
    expect(signals[0].sub).toContain("a.js:3");
  });

  it("provider.toSignals delegates to the same pure fold", () => {
    const r = [{ tool: "tsc" as const, ok: true, diagnostics: [], runtimeMs: 1, exitCode: 0 }];
    expect(provider.toSignals(r)).toEqual(resultsToSignals(r));
  });
});

describe("FakeAiReviewProvider — tools-first, then LLM-on-facts (deferred LLM)", () => {
  const review = new FakeAiReviewProvider();

  it("derives the review PURELY from tool facts — never invents a finding", async () => {
    const results = [
      {
        tool: "eslint" as const,
        ok: false,
        diagnostics: [
          {
            tool: "eslint" as const,
            file: "a.js",
            line: 1,
            severity: "error" as const,
            rule: "prefer-const",
            message: "use const",
            fix: { description: "fix", autoApplicable: true, ruleId: "prefer-const" },
          },
        ],
        runtimeMs: 10,
        exitCode: 1,
      },
    ];
    const out = await review.review(results);
    expect(out.provider).toBe("fake");
    expect(out.errorCount).toBe(1);
    expect(out.warningCount).toBe(0);
    expect(out.findings).toHaveLength(1);
    // Every finding is grounded in a real diagnostic (1:1, no extras).
    expect(out.findings[0].diagnostic.rule).toBe("prefer-const");
    expect(out.findings[0].comment).toContain("a.js:1");
    expect(out.summary).toContain("auto-fixable");
  });

  it("is deterministic — same facts in, same review out", async () => {
    const results = [
      { tool: "tsc" as const, ok: true, diagnostics: [], runtimeMs: 5, exitCode: 0 },
    ];
    const a = await review.review(results);
    const b = await review.review(results);
    expect(a).toEqual(b);
    expect(a.findings).toHaveLength(0);
    expect(a.summary).toContain("passed clean");
  });
});
