#!/usr/bin/env node
/**
 * Compile the headless sidecar to a STANDALONE single-file binary for the host
 * platform and place it where Tauri's `externalBin` expects it: a
 * target-triple-suffixed name under `src-tauri/binaries/` (road-to-desktop-release P0).
 *
 * `bun build --compile` embeds the Bun runtime + the JS module graph + imported
 * assets (the task-forge fixtures are static JSON imports for exactly this
 * reason — see sidecar/task-forge/load-fixtures.ts), so the packaged app needs
 * NO host Node/Bun installed. The prod transport stays the unix socket; the
 * Tauri shell spawns this binary and the webview reaches it through the Rust IPC
 * relay (no listening port in the shipped build).
 *
 * Dev is unaffected: `pnpm dev` still runs the sidecar under host Node.
 *
 * Usage: `node scripts/build-sidecar.mjs` (run on the build host — needs bun + rustc).
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The canonical Tauri target triple, read from `rustc -vV`'s `host:` line. */
function hostTriple() {
  const out = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const match = out.match(/^host:\s*(.+)$/m);
  if (!match) throw new Error("could not parse `host:` triple from `rustc -vV`");
  return match[1].trim();
}

const triple = hostTriple();
const outDir = join(APP, "src-tauri", "binaries");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `capisco-sidecar-${triple}`);

execFileSync(
  "bun",
  ["build", "sidecar/main.ts", "--compile", "--target=bun", "--outfile", outFile],
  { cwd: APP, stdio: "inherit" },
);

console.log(`✅ sidecar single-binary → src-tauri/binaries/capisco-sidecar-${triple}`);
