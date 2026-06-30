import { describe, expect, it } from "vitest";

import { mockQualityProvider } from "./quality.ts";

/**
 * real-runtime P2 — the browser-mode quality mock is deterministic and satisfies
 * the QualityProvider contract, so a diagnostics/fixes view renders offline and
 * `toSignals` matches the real provider (shared pure fold).
 */
describe("mockQualityProvider", () => {
  it("lists the TS-pack tools", async () => {
    expect(await mockQualityProvider.availableTools("/repo")).toEqual([
      "eslint",
      "tsc",
      "vitest",
    ]);
  });

  it("run() returns a deterministic result per tool (eslint warning, tsc error)", async () => {
    const eslint = await mockQualityProvider.run("/repo", "eslint");
    expect(eslint).toMatchObject({ tool: "eslint", ok: true });
    expect(eslint.diagnostics[0]).toMatchObject({ rule: "prefer-const", severity: "warning" });
    expect(eslint.diagnostics[0].fix?.autoApplicable).toBe(true);

    const tsc = await mockQualityProvider.run("/repo", "tsc");
    expect(tsc.ok).toBe(false); // a TS error
    expect(tsc.diagnostics[0]).toMatchObject({ rule: "TS2322", severity: "error" });
  });

  it("runAll() folds to signals via the shared pure transform", async () => {
    const results = await mockQualityProvider.runAll("/repo");
    expect(results.map((r) => r.tool)).toEqual(["eslint", "tsc", "vitest"]);
    const signals = mockQualityProvider.toSignals(results);
    // One lint signal per tool; tsc carries the error severity → warning on the rail.
    expect(signals.map((s) => s.id)).toEqual(["lint-eslint", "lint-tsc", "lint-vitest"]);
    expect(signals.find((s) => s.id === "lint-tsc")?.sev).toBe("warning");
    expect(signals.find((s) => s.id === "lint-vitest")?.sev).toBe("success");
  });
});
