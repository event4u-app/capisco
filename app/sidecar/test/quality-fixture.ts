/**
 * Hermetic fixture-worktree helper for the quality-runner tests (B5). Creates a
 * throwaway directory under the OS temp dir with eslint/tsc/vitest fixture files
 * and a self-contained eslint flat config, so the runner can lint/typecheck/test
 * real files without any global config leakage. Mirrors `git-temp-repo.ts`.
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

export interface FixtureWorktree {
  dir: string;
  write(relPath: string, content: string): void;
  cleanup(): void;
}

function makeBase(): FixtureWorktree {
  const dir = mkdtempSync(join(tmpdir(), "capisco-quality-"));
  return {
    dir,
    write(relPath: string, content: string): void {
      const full = join(dir, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, "utf8");
    },
    cleanup(): void {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A self-contained eslint flat config with two deterministic rules — no
 * reliance on the worktree finding the app's config. */
const ESLINT_CONFIG = `export default [
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module" },
    rules: {
      "prefer-const": "error",
      "no-unused-vars": "warn",
    },
  },
];
`;

/**
 * A worktree with a known eslint problem: one fixable `prefer-const` error and
 * one `no-unused-vars` warning (both on the same unused `let`).
 */
export function makeEslintFixture(): FixtureWorktree {
  const wt = makeBase();
  wt.write("eslint.config.mjs", ESLINT_CONFIG);
  wt.write("sample.js", "let x = 1;\nconsole.log(x);\nlet unused = 2;\n");
  return wt;
}

/** A worktree with a clean eslint fixture (no problems). */
export function makeCleanEslintFixture(): FixtureWorktree {
  const wt = makeBase();
  wt.write("eslint.config.mjs", ESLINT_CONFIG);
  wt.write("ok.js", "const x = 1;\nconsole.log(x);\n");
  return wt;
}

/** A worktree with a known tsc type error. */
export function makeTscFixture(): FixtureWorktree {
  const wt = makeBase();
  wt.write("bad.ts", 'export const n: number = "not a number";\n');
  return wt;
}

/** A worktree with one passing + one failing vitest test. */
export function makeVitestFixture(): FixtureWorktree {
  const wt = makeBase();
  wt.write("sum.js", "export const sum = (a, b) => a + b;\n");
  wt.write(
    "sum.test.js",
    `import { expect, test } from "vitest";
import { sum } from "./sum.js";
test("adds correctly", () => { expect(sum(1, 2)).toBe(3); });
test("fails on purpose", () => { expect(sum(1, 2)).toBe(4); });
`,
  );
  return wt;
}
