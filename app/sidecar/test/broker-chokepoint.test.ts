// @vitest-environment node
/**
 * Security architecture test (road-to-runnable-dev — Review must-fix).
 *
 * The Iron invariant: every real side effect (process spawn, network fetch,
 * filesystem WRITE, raw socket connect-out) is reachable ONLY through the
 * broker-mediated first-party execution primitives — the chokepoint. A denied
 * capability must mean no side effect.
 *
 * This test enforces that structurally: it scans every non-test `sidecar/**`
 * source file and FAILS if a forbidden side-effect token (`child_process`,
 * `fetch(`, fs-write calls) appears OUTSIDE the explicit allowlist of execution
 * primitives. New code cannot smuggle an unmediated `child_process` / fs-write /
 * `fetch` into a provider — it would have to live in an allowlisted primitive,
 * which is the broker's gated surface.
 *
 * Allowlist = the audited execution-primitive files. Each entry is the single
 * place a given side effect lives; the broker (or the provider that wraps it)
 * is the only caller. Adding a new file here is a deliberate, reviewed act.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const SIDECAR_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Files permitted to contain a given side-effect class. Keyed by POSIX-relative
 * path from `sidecar/`. The value lists which side-effect classes that file is
 * the audited home for. The broker gates *which* of these run at execution time;
 * this list pins *where* the primitives may physically live.
 */
const EXECUTION_PRIMITIVES: Record<string, ReadonlyArray<SideEffect>> = {
  // The system-`git` exec primitive (B1). execFile, no shell.
  "git/git-exec.ts": ["process"],
  // The quality-tool runner (B5) shells out to eslint/tsc/vitest. execFile.
  "quality/real-quality-provider.ts": ["process"],
  // The ACP agent transport (B3) spawns the agent child process.
  "acp/acp-transport.ts": ["process"],
  // The machine-wide Recent-Projects registry (B0) — atomic fs writes.
  "recent/recent-projects.ts": ["fs-write"],
  // The project fs READ primitive (P1) — no writes, but it is the audited
  // `node:fs` home for tree/content reads. Reads are not a forbidden class
  // here (only writes are), but listing it documents the chokepoint.
  "fs/fs-exec.ts": ["fs-read"],
  // The project fs WRITE primitive (P2) — the audited `node:fs` home for editor
  // saves. Its ONLY caller is the broker-gated perform adapter
  // (`fs-write-broker.ts`), which runs it inside `broker.execute`. A denied
  // capability never reaches this file → no disk change.
  "fs/fs-write-exec.ts": ["fs-write"],
  // Server infrastructure: the unix-socket sidecar removes its OWN stale socket
  // file on bind/close. This is socket-lifecycle housekeeping of a path the
  // server itself owns — not an agent-reachable capability write.
  "server/sidecar.ts": ["fs-write"],
};

type SideEffect = "process" | "fs-write" | "fetch" | "fs-read";

/** Forbidden patterns per side-effect class. fs-read is not policed (reads are
 * not a mutating side effect); the row exists so the allowlist can name it. */
const PATTERNS: Record<Exclude<SideEffect, "fs-read">, RegExp[]> = {
  // The `node:child_process` import is the real gate — you cannot spawn without
  // it. `RegExp.prototype.exec` is excluded by only matching the child_process
  // call names (execFile/spawn, optionally Sync), never a bare `exec(`.
  process: [
    /node:child_process/,
    /\bexecFile(Sync)?\s*\(/,
    /\bspawn(Sync)?\s*\(/,
    /\bchild_process\b/,
  ],
  // Match the actual `node:fs` write CALLS the sidecar uses (all synchronous —
  // the codebase is sync-fs throughout), never a coincidental provider METHOD
  // named `writeFile` (e.g. `ProjectFsProvider.writeFile`, which delegates to
  // the broker and performs no `node:fs` write itself). Requiring the `Sync`
  // suffix on the families that collide with method names removes that false
  // positive while keeping teeth: an injected `writeFileSync` / `mkdirSync` /
  // `rmSync` outside the allowlist still fails. The bare destructive `rm`/`rmdir`
  // promise forms (`fs.promises.rm`) are matched too.
  "fs-write": [
    /\bwriteFileSync\s*\(/,
    /\bappendFileSync\s*\(/,
    /\brenameSync\s*\(/,
    /\bmkdirSync\s*\(/,
    /\bunlinkSync\s*\(/,
    /\brmSync\s*\(/,
    /\brmdirSync\s*\(/,
    /\bfs\.(rm|rmdir|unlink|writeFile|appendFile|rename|mkdir)\s*\(/,
  ],
  // Egress only: HTTP client (`fetch`, `node:https`). `node:http` createServer
  // is INBOUND (the dev bridge's loopback server); `node:net` unix-socket
  // connect/listen is the IPC SPINE itself (the sidecar's own socket) — neither
  // is arbitrary network egress, so neither is matched. The lethal-trifecta
  // concern this guards is an agent reaching an arbitrary remote host, which
  // would surface as `fetch(` / `node:https`.
  fetch: [/\bfetch\s*\(/, /node:https\b/],
};

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      // The test tree is infrastructure: temp-repo + fixture helpers
      // legitimately spawn git / write scratch files. Out of scope of the
      // production-side-effect policy. Likewise the deferred Rust shell stub.
      if (entry.name === "test" || entry.name === "shell-stub") continue;
      out.push(...listSourceFiles(abs));
      continue;
    }
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".spec.ts")) continue;
    out.push(abs);
  }
  return out;
}

function rel(abs: string): string {
  return relative(SIDECAR_ROOT, abs).split("\\").join("/");
}

describe("broker chokepoint — side effects only inside audited execution primitives", () => {
  const files = listSourceFiles(SIDECAR_ROOT).filter((f) => statSync(f).isFile());

  it("scans a non-trivial number of sidecar source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("never spawns a process outside the allowlisted execution primitives", () => {
    assertNoViolations("process", files);
  });

  it("never writes to the filesystem outside the allowlisted execution primitives", () => {
    assertNoViolations("fs-write", files);
  });

  it("never performs network egress (fetch / outbound socket) outside the broker path", () => {
    // No sidecar file is currently permitted network egress — the whole tree is
    // policed. A future net adapter would be added to EXECUTION_PRIMITIVES with
    // a "fetch" class and an explicit review.
    assertNoViolations("fetch", files);
  });

  it("keeps the test allowlist honest (every entry exists)", () => {
    for (const path of Object.keys(EXECUTION_PRIMITIVES)) {
      const abs = join(SIDECAR_ROOT, path);
      expect(() => statSync(abs), `allowlisted primitive missing: ${path}`).not.toThrow();
    }
  });
});

function assertNoViolations(effect: Exclude<SideEffect, "fs-read">, files: string[]): void {
  const violations: string[] = [];
  for (const abs of files) {
    const path = rel(abs);
    const allowed = EXECUTION_PRIMITIVES[path]?.includes(effect) ?? false;
    if (allowed) continue;
    const text = readFileSync(abs, "utf8");
    for (const line of stripComments(text).split("\n")) {
      for (const re of PATTERNS[effect]) {
        if (re.test(line)) {
          violations.push(`${path}: ${line.trim()}`);
        }
      }
    }
  }
  expect(
    violations,
    `forbidden ${effect} side effect outside the broker-mediated execution primitives:\n` +
      violations.join("\n") +
      "\n\nIf this is a new audited primitive, add it to EXECUTION_PRIMITIVES with review.",
  ).toEqual([]);
}

/** Strip line + block comments so doc-prose mentioning a token never trips. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}
