// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PtyHost } from "../runtime/pty-host.ts";

/**
 * road-to-actually-works P6 — LIVE PTY conformance (real-where-autonomous).
 *
 * Spawns a REAL shell through the PtyHost (node-pty backend, no fakes), echoes a
 * marker, and asserts it comes back over the data stream — the "echter PTY-Echo
 * vs. erwartetes Shape" acceptance. Also proves the working dir is the requested
 * worktree and that resize does not disturb a live shell. Gated on node-pty
 * loading natively; skips cleanly where the native build is unavailable.
 */
let ptyAvailable = false;
try {
  await import("node-pty");
  ptyAvailable = true;
} catch {
  ptyAvailable = false;
}

/** Subscribe and resolve the accumulated output of terminal `id` once `marker` shows. */
function waitForMarker(
  host: PtyHost,
  opts: { id: string; marker: string; timeoutMs?: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const off = host.subscribe(opts.id, (e) => {
      if (e.kind !== "data") return;
      buf += e.data;
      if (buf.includes(opts.marker)) {
        cleanup();
        resolve(buf);
      }
    });
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for ${opts.marker}; tail: ${JSON.stringify(buf.slice(-300))}`));
    }, opts.timeoutMs ?? 8000);
    function cleanup(): void {
      clearTimeout(timer);
      off();
    }
  });
}

/** Open a shell, send `input`, resolve the accumulated output once `marker` shows. */
async function expectEcho(
  host: PtyHost,
  opts: { id: string; cwd: string; input: string; marker: string; timeoutMs?: number },
): Promise<string> {
  const pending = waitForMarker(host, opts);
  await host.open({ id: opts.id, cwd: opts.cwd, cols: 80, rows: 24 });
  host.write(opts.id, opts.input);
  return pending;
}

describe.skipIf(!ptyAvailable)("PTY live conformance (real shell)", () => {
  let host: PtyHost | undefined;
  afterEach(() => {
    host?.killAll();
    host = undefined;
  });

  it("runs a command in a real shell (arithmetic proves execution, not echo)", async () => {
    host = new PtyHost();
    // The shell must COMPUTE 21*2 → the marker `LIVE_42_OK` exists only in real
    // output, never in the echoed keystrokes — so this proves execution.
    const out = await expectEcho(host, {
      id: "live-1",
      cwd: process.cwd(),
      input: 'echo "LIVE_$((21 * 2))_OK"\r',
      marker: "LIVE_42_OK",
    });
    expect(out).toContain("LIVE_42_OK");
    expect((await host.list())[0]).toMatchObject({ id: "live-1", state: "running" });
    expect((await host.list())[0].pid).toBeGreaterThan(0);
  });

  it("runs in the requested working directory (worktree)", async () => {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), "capisco-pty-")));
    host = new PtyHost();
    // `$PWD` expands in-shell to the worktree; a shell-COMPUTED sentinel (`:56088`
    // = 123*456) on the same line is output-only — it is in neither the echoed
    // keystrokes (`:%d`) nor zsh's cwd prompt-title escape, so resolving on it
    // guarantees the printf output (not the prompt) arrived.
    const out = await expectEcho(host, {
      id: "live-cwd",
      cwd: dir,
      input: "printf 'CWDIS=%s:%d\\n' \"$PWD\" $((123 * 456))\r",
      marker: ":56088",
    });
    // The PTY wraps the long path at the column width, inserting \r\n; collapse
    // whitespace so the `CWDIS=<dir>:56088` envelope matches regardless of wrap.
    expect(out.replace(/\s/g, "")).toContain(`CWDIS=${dir}:56088`);
  });

  it("resizes a live PTY without disturbing it", async () => {
    host = new PtyHost();
    await host.open({ id: "live-resize", cwd: process.cwd(), cols: 80, rows: 24 });
    await host.resize("live-resize", 120, 40);
    // The shell still works after a resize: a computed marker round-trips (no
    // re-open). Arithmetic again proves real execution, not keystroke echo.
    const pending = waitForMarker(host, { id: "live-resize", marker: "RESIZE_40_OK" });
    await host.write("live-resize", 'echo "RESIZE_$((20 + 20))_OK"\r');
    expect(await pending).toContain("RESIZE_40_OK");
  });
});
