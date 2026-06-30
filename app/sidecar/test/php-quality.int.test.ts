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

import { ecsInContainer, phpstanInContainer, rectorInContainer } from "../quality/php-quality.ts";
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

describe("rectorInContainer / ecsInContainer ↔ real jakzal/phpqa image", () => {
  let dir: string;

  beforeAll(() => {
    if (!live) return;
    dir = mkdtempSync(join(tmpdir(), "capisco-phpqa-"));
    mkdirSync(join(dir, "src"), { recursive: true });
    // rector.php + ecs.php at the worktree root (auto-discovered, cwd = mount).
    writeFileSync(
      join(dir, "rector.php"),
      "<?php\nuse Rector\\Config\\RectorConfig;\nreturn RectorConfig::configure()\n" +
        "    ->withPaths([__DIR__ . '/src'])\n" +
        "    ->withPreparedSets(deadCode: true, codeQuality: true);\n",
      "utf8",
    );
    writeFileSync(
      join(dir, "ecs.php"),
      "<?php\nuse Symplify\\EasyCodingStandard\\Config\\ECSConfig;\nreturn ECSConfig::configure()\n" +
        "    ->withPaths([__DIR__ . '/src'])\n" +
        "    ->withPreparedSets(psr12: true);\n",
      "utf8",
    );
    // Messy file: an unused var (Rector dead-code) + bad formatting (ECS).
    writeFileSync(
      join(dir, "src", "Bad.php"),
      "<?php\nclass Bad {\n    public function run($x) {\n        $unused = 1;\n" +
        "        if ($x === true) { return true; } else { return false; }\n    }\n}\n",
      "utf8",
    );
  });

  afterAll(() => {
    if (live && dir) rmSync(dir, { recursive: true, force: true });
  });

  runLive(
    "Rector reports advisory (warning) suggestions, worktree-relative, never a RED",
    async () => {
      const result = await rectorInContainer(dir, { files: ["src"] });
      expect(result.tool).toBe("rector");
      expect(result.diagnostics.length).toBeGreaterThan(0);
      const d = result.diagnostics[0];
      expect(d.file).toBe("src/Bad.php");
      expect(d.severity).toBe("warning");
      expect(d.rule).toMatch(/^Rector\\/);
      // Advisory: no error-severity → ok stays true, gate is not RED.
      expect(result.ok).toBe(true);
      expect(verdictFromResults([result]).failed).toBe(false);
    },
    300_000,
  );

  runLive(
    "ECS reports advisory (warning) coding-standard fixes, worktree-relative",
    async () => {
      const result = await ecsInContainer(dir, { files: ["src"] });
      expect(result.tool).toBe("ecs");
      expect(result.diagnostics.length).toBeGreaterThan(0);
      const d = result.diagnostics[0];
      expect(d.file).toBe("src/Bad.php");
      expect(d.severity).toBe("warning");
      expect(result.ok).toBe(true);
      expect(verdictFromResults([result]).failed).toBe(false);
    },
    300_000,
  );
});
