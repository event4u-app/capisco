#!/usr/bin/env node
/**
 * Capisco doctor — reality-gate preflight (road-to-actually-works P0).
 *
 * Checks whether THIS machine carries the toolchains the W-series needs, and
 * reports per dependency: ready / missing / wrong-version + a fix hint. It
 * mutates nothing — pure read-only probes (`which` + `--version`), never through
 * a shell (execFile with a discrete argv array; no injection surface). Mirrors
 * the posture of sidecar/provision/detect-exec.ts, kept standalone so it runs on
 * a fresh clone with zero build step: `node scripts/doctor.mjs` (or `task doctor`).
 *
 * Exit code: 0 always — doctor reports, it never blocks. The phase-blocking is
 * the agent's job per the roadmap, informed by this output.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { arch, platform } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";

const PROBE_TIMEOUT_MS = 4000;
const MAX_BUFFER = 1024 * 1024;

/** The claude CLI version this build certifies its stream-json parser against. */
const CLAUDE_CERTIFIED = "1.4"; // major.minor floor; drift above is fine, below warns.

/** Resolve a command to an existing executable path, or undefined. No spawn. */
function resolveBin(command, env = process.env) {
  if (!command) return undefined;
  if (isAbsolute(command) || command.includes("/")) {
    return existsSync(command) ? command : undefined;
  }
  const paths = (env.PATH ?? "").split(delimiter).filter(Boolean);
  for (const dir of paths) {
    const candidate = join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/** Read `<bin> <args>` output (read-only probe). Resolves { ok, out } or { ok:false }. */
function probe(command, args = ["--version"]) {
  return new Promise((resolve) => {
    const bin = resolveBin(command);
    if (!bin) return resolve({ ok: false, missing: true });
    execFile(
      bin,
      args,
      { timeout: PROBE_TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) return resolve({ ok: false, path: bin, error: String(err.message ?? err) });
        resolve({ ok: true, path: bin, out: `${stdout}`.trim() || `${stderr}`.trim() });
      },
    );
  });
}

const GREEN = "\x1b[32m", RED = "\x1b[31m", YEL = "\x1b[33m", DIM = "\x1b[2m", RST = "\x1b[0m";
const ICON = { ready: `${GREEN}✅${RST}`, missing: `${RED}❌${RST}`, warn: `${YEL}⚠️${RST}` };

function firstVersion(s) {
  const m = `${s ?? ""}`.match(/\d+\.\d+(\.\d+)?/);
  return m ? m[0] : (s ?? "").split("\n")[0];
}

/** A check returns { name, status: ready|missing|warn, detail, fix, blocks }. */
async function checkBin({ name, command, args, blocks, fix, minVersion, optional }) {
  const r = await probe(command, args);
  if (!r.ok) {
    return {
      name,
      status: optional ? "warn" : "missing",
      detail: r.missing ? "not on PATH" : `present but failed: ${r.error ?? "?"}`,
      fix,
      blocks,
    };
  }
  const version = firstVersion(r.out);
  if (minVersion && cmpVersion(version, minVersion) < 0) {
    return { name, status: "warn", detail: `${version} < certified ${minVersion}`, fix, blocks };
  }
  return { name, status: "ready", detail: `${version}  ${DIM}${r.path}${RST}`, blocks };
}

function cmpVersion(a, b) {
  const pa = `${a}`.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = `${b}`.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

const CHECKS = [
  // Core — always needed.
  { name: "Node.js", command: "node", blocks: "everything", fix: "https://nodejs.org" },
  { name: "pnpm", command: "pnpm", blocks: "everything", fix: "corepack enable && corepack prepare pnpm@latest --activate" },
  // P2 — real agent.
  {
    name: "claude CLI", command: "claude", args: ["--version"], minVersion: CLAUDE_CERTIFIED,
    blocks: "P2 (echter Agent)", fix: "https://docs.claude.com/claude-code — then `claude login`",
  },
  { name: "codex CLI (optional)", command: "codex", blocks: "P2 Multi-Backend", optional: true, fix: "optional alternate agent backend" },
  { name: "gemini CLI (optional)", command: "gemini", blocks: "P2 Multi-Backend", optional: true, fix: "optional alternate agent backend" },
  // P6/P7 — Tauri shell.
  { name: "Rust (cargo)", command: "cargo", blocks: "P6/P7 (Tauri-Shell)", fix: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" },
  { name: "rustc", command: "rustc", blocks: "P6/P7 (Tauri-Shell)", fix: "installed with rustup" },
  // P5 — LSP.
  { name: "typescript-language-server", command: "typescript-language-server", blocks: "P5 (LSP, TS)", optional: true, fix: "npm i -g typescript-language-server typescript" },
  { name: "intelephense (PHP LSP)", command: "intelephense", blocks: "P5 (LSP, PHP)", optional: true, fix: "npm i -g intelephense  (or phpactor)" },
  // real-runtime — container + debug.
  { name: "Docker", command: "docker", blocks: "real-runtime P0 (Container)", optional: true, fix: "https://docs.docker.com/get-docker/" },
  { name: "devcontainer CLI", command: "devcontainer", blocks: "real-runtime P0 (Devcontainer)", optional: true, fix: "npm i -g @devcontainers/cli" },
  // node-pty native-build prereqs (P6 terminal / packaging).
  { name: "python3 (node-pty build)", command: "python3", blocks: "P6 Terminal (node-pty build)", optional: true, fix: "needed for native node-pty compile" },
  { name: "make (node-pty build)", command: "make", blocks: "P6 Terminal (node-pty build)", optional: true, fix: "xcode-select --install (macOS) / build-essential (Linux)" },
  { name: "cc (node-pty build)", command: "cc", args: ["--version"], blocks: "P6 Terminal (node-pty build)", optional: true, fix: "xcode-select --install (macOS) / build-essential (Linux)" },
];

async function main() {
  process.stdout.write(`\n${RST}Capisco doctor — reality-gate (road-to-actually-works P0)\n`);
  process.stdout.write(`${DIM}Platform: ${platform()} ${arch()}${RST}\n\n`);

  const results = await Promise.all(CHECKS.map(checkBin));
  const pad = Math.max(...CHECKS.map((c) => c.name.length));
  for (const r of results) {
    const icon = ICON[r.status];
    const name = r.name.padEnd(pad);
    const blocks = r.blocks ? `${DIM}→ ${r.blocks}${RST}` : "";
    process.stdout.write(`  ${icon}  ${name}  ${r.detail}\n`);
    if (r.status !== "ready") {
      process.stdout.write(`        ${blocks}\n        ${DIM}fix: ${r.fix}${RST}\n`);
    }
  }

  const missing = results.filter((r) => r.status === "missing");
  const warn = results.filter((r) => r.status === "warn");
  process.stdout.write(`\n${missing.length === 0 ? GREEN + "core ready" : RED + missing.length + " core missing"}${RST}`);
  process.stdout.write(`${DIM} · ${warn.length} optional/blocked-phase not ready${RST}\n`);
  process.stdout.write(`${DIM}Doctor reports; it never blocks. Phase-gating is enforced by the roadmap.${RST}\n\n`);
}

main().catch((e) => {
  process.stderr.write(`doctor crashed: ${e?.stack ?? e}\n`);
  process.exit(0); // never block
});
