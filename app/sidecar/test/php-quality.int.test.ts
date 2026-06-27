/**
 * Containerized PHPStan quality (road-to-real-runtime P2). LIVE: runs the real
 * phpstan image over a PHP fixture mounted read-only, asserts the structured
 * diagnostic, and confirms the RED verdict feeds the model-routing escalation
 * gate (verdictFromResults) the same way eslint/tsc do. Skips cleanly when
 * docker is not on PATH.
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { phpstanInContainer } from "../quality/php-quality.ts";
import { verdictFromResults } from "../model-routing/escalation.ts";

function which(cmd: string): boolean {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir && existsSync(join(dir, cmd))) return true;
  }
  return false;
}

const live = which("docker");
const runLive = live ? it : it.skip;

describe("phpstanInContainer ↔ real phpstan Docker image", () => {
  let dir: string;

  beforeAll(() => {
    if (!live) return;
    dir = mkdtempSync(join(tmpdir(), "capisco-phpq-"));
    mkdirSync(join(dir, "src"), { recursive: true });
    // A type error PHPStan catches at level 5: returns int from a string-typed fn.
    writeFileSync(
      join(dir, "src", "Bad.php"),
      "<?php\nfunction add(int $a, int $b): string {\n    return $a + $b;\n}\n",
      "utf8",
    );
  });

  afterAll(() => {
    if (live && dir) rmSync(dir, { recursive: true, force: true });
  });

  runLive(
    "finds the real type error and produces a RED verdict for the escalation gate",
    async () => {
      const result = await phpstanInContainer(dir, { level: 5 });
      expect(result.tool).toBe("phpstan");
      expect(result.ok).toBe(false);
      expect(result.diagnostics.length).toBeGreaterThan(0);
      const d = result.diagnostics[0];
      expect(d.tool).toBe("phpstan");
      expect(d.file).toBe("src/Bad.php"); // container path relativised back
      expect(d.severity).toBe("error");
      expect(d.rule).toBe("return.type");

      // The same fold the escalation loop uses → RED, carrying the real error.
      const verdict = verdictFromResults([result]);
      expect(verdict.failed).toBe(true);
      expect(verdict.diagnostics.some((x) => x.tool === "phpstan")).toBe(true);
    },
    300_000,
  );
});
