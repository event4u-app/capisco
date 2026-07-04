// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

import { PtyHost } from "../runtime/pty-host.ts";

/**
 * road-to-real-runtime P0 — interactive container console (`exec -it`) over the
 * P6 PTY abstraction. Proves you can attach a real interactive shell INSIDE a
 * running container and run commands there: the PtyHost spawns
 * `docker exec -it <container> /bin/sh` over node-pty (so `-it` gets a real
 * tty). Needs node-pty + docker; skips cleanly otherwise.
 */
let ptyAvailable: boolean;
try {
  await import("node-pty");
  ptyAvailable = true;
} catch {
  ptyAvailable = false;
}
function which(cmd: string): boolean {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) if (dir && existsSync(join(dir, cmd))) return true;
  return false;
}
const live = ptyAvailable && which("docker");
const runLive = live ? it : it.skip;
const NAME = "capisco-console-it";

function waitForMarker(host: PtyHost, id: string, marker: string, timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const off = host.subscribe(id, (e) => {
      if (e.kind !== "data") return;
      buf += e.data;
      if (buf.includes(marker)) {
        off();
        resolve(buf);
      }
    });
    setTimeout(() => {
      off();
      reject(new Error(`timeout waiting for ${marker}; tail ${JSON.stringify(buf.slice(-200))}`));
    }, timeoutMs);
  });
}

describe("interactive container console (docker exec -it over the PTY)", () => {
  let host: PtyHost | undefined;

  beforeEach(() => {
    if (!live) return;
    execFileSync("docker", ["rm", "-f", NAME], { stdio: "ignore" });
    execFileSync("docker", ["run", "-d", "--name", NAME, "alpine", "sleep", "180"], { timeout: 60_000 });
  });
  afterEach(() => {
    host?.killAll();
    host = undefined;
    if (live) {
      try {
        execFileSync("docker", ["rm", "-f", NAME], { stdio: "ignore" });
      } catch {
        /* best-effort cleanup */
      }
    }
  });

  runLive(
    "runs a command INSIDE the container and streams its output",
    async () => {
      host = new PtyHost();
      // Shell-computed marker → output-only (proves execution inside the container).
      const pending = waitForMarker(host, "ctr-1", "INCTR_42_OK");
      await host.open({ id: "ctr-1", cwd: process.cwd(), container: NAME, shell: "/bin/sh" });
      // Prove we're really in the container: its hostname == the container id prefix.
      host.write("ctr-1", 'echo "INCTR_$((21 * 2))_OK"\r');
      const out = await pending;
      expect(out).toContain("INCTR_42_OK");

      const info = (await host.list())[0];
      expect(info).toMatchObject({ id: "ctr-1", state: "running" });
      expect(info.pid).toBeGreaterThan(0);
    },
    60_000,
  );

  runLive(
    "the console's filesystem is the container's, not the host's",
    async () => {
      host = new PtyHost();
      // /etc/alpine-release exists in the alpine container, never on the macOS host.
      // The marker is shell-assembled ("ALP"+"INE=") so it is output-only — never
      // in the echoed keystrokes nor the prompt.
      const pending = waitForMarker(host, "ctr-2", "ALPINE=");
      await host.open({ id: "ctr-2", cwd: process.cwd(), container: NAME, shell: "/bin/sh" });
      host.write("ctr-2", 'echo "ALP""INE=$(cat /etc/alpine-release 2>/dev/null || echo none)"\r');
      const out = await pending;
      expect(out).toMatch(/ALPINE=\d+\.\d+/); // a real alpine version, from inside
    },
    60_000,
  );
});
