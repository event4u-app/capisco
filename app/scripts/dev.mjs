/**
 * Dev launcher (road-to-runnable-dev P0) — starts the dev sidecar WebSocket
 * bridge AND the Vite dev server concurrently, so `pnpm dev` brings up the UI
 * wired to the REAL sidecar (no Tauri/cargo). Dependency-free (no `concurrently`)
 * to match the project's no-new-dep posture.
 *
 * Output from each child is line-prefixed. Ctrl-C / SIGTERM tears both down.
 * NOT FOR PRODUCTION — the bridge it launches binds 127.0.0.1 only and is
 * dev-only plumbing.
 */

import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");

/**
 * Dep-free `.env.local` loader (dev secrets/config — gitignored, never committed).
 * Parses `KEY=VALUE` lines (ignores blanks / `#` comments, strips surrounding
 * quotes) so the SIDECAR inherits e.g. CAPISCO_ACP_CLI / CAPISCO_ACP_API_KEY.
 * The sidecar vaults any key at startup and injects it only at the execution
 * layer (broker) — values never reach the agent subprocess or the browser.
 */
function loadEnvLocal() {
  const file = join(appRoot, ".env.local");
  if (!existsSync(file)) return {};
  const out = {};
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

// `.env.local` overrides the inherited shell env for the dev children.
const childEnv = { ...process.env, ...loadEnvLocal() };

/** Spawn a child, prefixing each output line with `[label]`. */
function run(label, command, args) {
  const child = spawn(command, args, { cwd: appRoot, env: childEnv });
  const pipe = (stream, sink) => {
    let buf = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      buf += chunk;
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) sink.write(`[${label}] ${line}\n`);
    });
    stream.on("end", () => {
      if (buf) sink.write(`[${label}] ${buf}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  return child;
}

const bridge = run("sidecar", process.execPath, [
  "--import",
  join(appRoot, "scripts", "register-alias.mjs"),
  join(appRoot, "sidecar", "dev-bridge", "main.ts"),
]);
const vite = run("vite", process.execPath, [
  join(appRoot, "node_modules", "vite", "bin", "vite.js"),
]);

const children = [bridge, vite];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (!c.killed) c.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 200);
}

for (const c of children) {
  c.on("exit", (code) => {
    // If either child dies, bring the whole dev session down.
    shutdown(code ?? 0);
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
