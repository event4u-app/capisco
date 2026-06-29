// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { DbgpListener, type DbgpSession } from "../runtime/dbgp.ts";
import { deriveMountMap } from "../runtime/mount-map.ts";
import { DapPathMap, resolveXdebugClientHost } from "../runtime/dap-path-map.ts";

/**
 * road-to-real-runtime P1 — LIVE step-debugging over DBGp/xdebug, the roadmap's
 * real acceptance: set a breakpoint, the container's execution HALTS there, read
 * the real variable values, step. Uses thecodingmachine/php (xdebug toggled on)
 * connecting back to the sidecar DBGp listener via host.docker.internal — proves
 * the bridge + the P0-MountMap path translation end-to-end. Docker-only (no
 * adapter download); skips cleanly when docker is absent.
 */
function which(cmd: string): boolean {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (dir && existsSync(join(dir, cmd))) return true;
  }
  return false;
}
const live = which("docker");
const runLive = live ? it : it.skip;
const IMAGE = "thecodingmachine/php:8.3-v4-cli";

// script.php — breakpoint at line 4 ($x is still 41; after stepOver, 42).
const SCRIPT = `<?php
$greeting = "hello";
$x = 41;
$x = $x + 1;
echo $greeting;
`;
const BP_LINE = 4;

describe("DBGp/xdebug live debugging ↔ real container", () => {
  let dir: string;
  let listener: DbgpListener | undefined;
  let proc: ChildProcess | undefined;

  beforeEach(() => {
    if (!live) return;
    dir = mkdtempSync(join(tmpdir(), "capisco-dbgp-"));
    writeFileSync(join(dir, "script.php"), SCRIPT, "utf8");
  });

  afterEach(() => {
    proc?.kill("SIGKILL");
    listener?.close();
    listener = undefined;
    proc = undefined;
    if (live && dir) rmSync(dir, { recursive: true, force: true });
  });

  runLive(
    "halts at a breakpoint, reads real variables, and steps — paths via MountMap",
    async () => {
      // 1. Listen FIRST, then point the container's xdebug at the bound port.
      listener = new DbgpListener();
      const port = await listener.listen(0);

      // 2. Path mapping consumes the P0 MountMap (host dir ↔ /app).
      const mount = deriveMountMap({ localWorkspaceFolder: dir, config: { workspaceFolder: "/app" } });
      const pathMap = new DapPathMap(mount);
      const containerScript = pathMap.toDebuggee(join(dir, "script.php")); // /app/script.php
      const fileUri = `file://${containerScript}`;
      const clientHost = resolveXdebugClientHost(); // host.docker.internal on Docker Desktop

      // 3. Launch the debuggee: xdebug connects back to the host listener.
      proc = spawn("docker", [
        "run", "--rm", "-v", `${dir}:/app:ro`, "-w", "/app",
        "-e", "PHP_EXTENSION_XDEBUG=1",
        IMAGE,
        "php",
        "-d", "xdebug.mode=debug",
        "-d", "xdebug.start_with_request=yes",
        "-d", `xdebug.client_host=${clientHost}`,
        "-d", `xdebug.client_port=${port}`,
        "-d", "xdebug.discover_client_host=0",
        "/app/script.php",
      ]);

      // 4. Accept xdebug's connection, drive the debug session.
      const session: DbgpSession = await listener.accept(25_000);
      await session.init;

      await session.setBreakpoint(fileUri, BP_LINE);
      const brk = await session.run();
      expect(brk.status).toBe("break");
      expect(brk.lineno).toBe(BP_LINE);
      // The break location maps back to the HOST file the editor opens.
      const hostFile = pathMap.toEditor((brk.filename ?? "").replace(/^file:\/\//, ""));
      expect(hostFile).toBe(join(dir, "script.php"));

      // 5. Real variable values at the breakpoint (line 4 not yet executed → 41).
      const locals = await session.contextGet(0);
      expect(locals.find((p) => p.name === "$greeting")?.value).toBe("hello");
      expect(locals.find((p) => p.name === "$x")?.value).toBe("41");

      // 6. Step over line 4 → $x is now 42.
      await session.stepOver();
      const after = await session.contextGet(0);
      expect(after.find((p) => p.name === "$x")?.value).toBe("42");

      // 7. Continue to program end + tear down.
      await session.run();
      await session.stop();
    },
    120_000,
  );
});
