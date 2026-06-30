/**
 * Deterministic browser-mode {@link QualityProvider} (real-runtime P2). No
 * toolchain in the browser — this replays a fixed set of findings so a
 * diagnostics/fixes view renders offline (and pixel goldens stay stable). The
 * real runner lives in the sidecar; this is the swap-point fallback. `toSignals`
 * is the shared pure fold (identical to the real provider by construction).
 */

import type { Diagnostic, QualityProvider, QualityRunResult, QualityToolId } from "@/contracts";
import { resultsToSignals } from "@/contracts/quality-signals";

const TOOLS: QualityToolId[] = ["eslint", "tsc", "vitest"];

/** One auto-fixable eslint warning + a tsc error, so the view shows both a fix
 * and a hard finding. Deterministic (no Date.now / runtimeMs fixed). */
const SAMPLE: Record<string, Diagnostic[]> = {
  eslint: [
    {
      tool: "eslint",
      file: "src/example.ts",
      line: 12,
      column: 7,
      severity: "warning",
      rule: "prefer-const",
      message: "'count' is never reassigned. Use 'const' instead.",
      fix: {
        description: "Replace 'let' with 'const'",
        autoApplicable: true,
        ruleId: "prefer-const",
      },
    },
  ],
  tsc: [
    {
      tool: "tsc",
      file: "src/example.ts",
      line: 18,
      column: 3,
      severity: "error",
      rule: "TS2322",
      message: "Type 'string' is not assignable to type 'number'.",
    },
  ],
  vitest: [],
};

function resultFor(tool: QualityToolId): QualityRunResult {
  const diagnostics = SAMPLE[tool] ?? [];
  return {
    tool,
    ok: !diagnostics.some((d) => d.severity === "error"),
    diagnostics,
    runtimeMs: 0,
    exitCode: diagnostics.some((d) => d.severity === "error") ? 1 : 0,
  };
}

export const mockQualityProvider: QualityProvider = {
  availableTools: () => Promise.resolve([...TOOLS]),
  run: (_cwd, tool) => Promise.resolve(resultFor(tool)),
  runAll: () => Promise.resolve(TOOLS.map(resultFor)),
  toSignals: (results) => resultsToSignals(results),
};
