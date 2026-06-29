// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { DbgpListener, type DbgpSession } from "../runtime/dbgp.ts";
import { deriveMountMap } from "../runtime/mount-map.ts";
import { DapPathMap, resolveXdebugClientHost } from "../runtime/dap-path-map.ts";

/**
 * road-to-real-runtime P1, sub-item 5 — Tests im Debugger (DAP-Reuse). Proves
 * the SAME DBGp bridge debugs a real PHPUnit run, not just a script: PHPUnit
 * executes the test → calls the code under test → xdebug halts at the breakpoint
 * inside it, with the real arguments. Docker-only; the phpunit phar is lifted
 * from jakzal/phpqa (no xdebug there) and run under thecodingmachine/php (xdebug
 * on) — the two-image split is why this is its own test. Skips without docker.
 */
function which(cmd: string): boolean {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir && existsSync(join(dir, cmd))) return true;
  }
  return false;
}
const live = which("docker");
const runLive = live ? it : it.skip;
const PHP_IMAGE = "thecodingmachine/php:8.4-v4-cli"; // PHPUnit 13 requires PHP >= 8.4.1
const QA_IMAGE = "jakzal/phpqa:latest";

const CALC = `<?php
function add(int $a, int $b): int {
    $sum = $a + $b;
    return $sum;
}
`;
const BP_LINE = 3; // `$sum = $a + $b;` — $a/$b bound, $sum not yet
const TEST = `<?php
require __DIR__ . '/../src/Calc.php';
use PHPUnit\\Framework\\TestCase;
final class CalcTest extends TestCase {
    public function testAdd(): void {
        $this->assertSame(3, add(1, 2));
    }
}
`;

describe("DBGp/xdebug ↔ a real PHPUnit run (test-debug, DAP-reuse)", () => {
  let dir: string;
  let pharReady = false;
  let listener: DbgpListener | undefined;
  let proc: ChildProcess | undefined;

  beforeAll(() => {
    if (!live) return;
    // Lift the phpunit phar out of jakzal/phpqa into a shared temp the per-test
    // worktree copies from (one container run, not one per test).
    try {
      const shared = mkdtempSync(join(tmpdir(), "capisco-phar-"));
      execFileSync("docker", ["run", "--rm", "-v", `${shared}:/out`, QA_IMAGE, "sh", "-c", "cp /tools/phpunit /out/phpunit.phar"], { timeout: 120_000 });
      process.env.__CAPISCO_PHPUNIT_PHAR = join(shared, "phpunit.phar");
      pharReady = existsSync(process.env.__CAPISCO_PHPUNIT_PHAR);
    } catch {
      pharReady = false;
    }
  }, 180_000);

  beforeEach(() => {
    if (!live || !pharReady) return;
    dir = mkdtempSync(join(tmpdir(), "capisco-pu-"));
    mkdirSync(join(dir, "src"), { recursive: true });
    mkdirSync(join(dir, "tests"), { recursive: true });
    writeFileSync(join(dir, "src", "Calc.php"), CALC, "utf8");
    writeFileSync(join(dir, "tests", "CalcTest.php"), TEST, "utf8");
    execFileSync("cp", [process.env.__CAPISCO_PHPUNIT_PHAR as string, join(dir, "phpunit.phar")]);
  });

  afterEach(() => {
    proc?.kill("SIGKILL");
    listener?.close();
    listener = undefined;
    proc = undefined;
    if (live && dir) rmSync(dir, { recursive: true, force: true });
  });

  runLive(
    "halts inside the code under test while PHPUnit runs it",
    async () => {
      if (!pharReady) return; // phar lift failed → nothing to assert
      listener = new DbgpListener();
      const port = await listener.listen(0);

      const mount = deriveMountMap({ localWorkspaceFolder: dir, config: { workspaceFolder: "/app" } });
      const pathMap = new DapPathMap(mount);
      const calcUri = `file://${pathMap.toDebuggee(join(dir, "src", "Calc.php"))}`;

      proc = spawn("docker", [
        "run", "--rm", "-v", `${dir}:/app:ro`, "-w", "/app",
        "-e", "PHP_EXTENSION_XDEBUG=1",
        PHP_IMAGE,
        "php",
        "-d", "xdebug.mode=debug",
        "-d", "xdebug.start_with_request=yes",
        "-d", `xdebug.client_host=${resolveXdebugClientHost()}`,
        "-d", `xdebug.client_port=${port}`,
        "-d", "xdebug.discover_client_host=0",
        "phpunit.phar", "--no-configuration", "--do-not-cache-result", "tests/CalcTest.php",
      ]);

      const session: DbgpSession = await listener.accept(30_000);
      await session.init;
      await session.setBreakpoint(calcUri, BP_LINE);

      // PHPUnit bootstraps, discovers + runs testAdd → calls add(1, 2) → break.
      const brk = await session.run();
      expect(brk.status).toBe("break");
      expect(brk.lineno).toBe(BP_LINE);
      expect(pathMap.toEditor((brk.filename ?? "").replace(/^file:\/\//, ""))).toBe(
        join(dir, "src", "Calc.php"),
      );

      // The real test arguments are visible at the breakpoint inside add().
      const locals = await session.contextGet(0);
      expect(locals.find((p) => p.name === "$a")?.value).toBe("1");
      expect(locals.find((p) => p.name === "$b")?.value).toBe("2");

      await session.run(); // let PHPUnit finish the suite
      await session.stop();
    },
    150_000,
  );
});
