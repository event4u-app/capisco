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
  // The shared process supervisor (road-to-actually-works P1) — THE managed
  // spawn point for long-lived children (PTY/LSP/container-exec/DAP). spawn, no
  // shell, sealed env by default, piped stderr. It is the mechanism; the
  // capability DECISION to start a PTY/LSP/debugger is broker-gated at the layer
  // that calls it (those phases), the same posture as claude-stream-exec.ts.
  "supervisor/process-supervisor.ts": ["process"],
  // The LSP host (road-to-actually-works P5). It does NOT touch child_process
  // directly — it spawns the language server ONLY through the allowlisted
  // supervisor above (the scan matches `supervisor.spawn(` by method name). Read-
  // only language intelligence (completion/hover/diagnostics); no fs/net edge.
  "lsp/lsp-host.ts": ["process"],
  // Read-only docker introspection (road-to-real-runtime P0). execFile, no shell,
  // discrete argv; a mutating-verb guard refuses run/rm/exec/kill so it stays
  // read-only (`docker ps` / `docker stats --no-stream`). Same posture as detect-exec.ts.
  "runtime/docker-exec.ts": ["process"],
  // The MUTATING devcontainer lifecycle primitive (road-to-real-runtime P0) —
  // `devcontainer up` / `docker exec` / `docker rm -f`. execFile, no shell,
  // discrete argv. The mutating counterpart to docker-exec.ts; the capability
  // decision to start/stop a container is broker-gated at the calling layer
  // (same posture as install-exec.ts). It changes container state on purpose.
  "runtime/devcontainer-exec.ts": ["process"],
  // macOS keychain access (road-to-real-breadth P0). execFile `security`, no shell,
  // discrete argv. The one place secret VALUES touch a subprocess — single `capisco`
  // service namespace, `-U` idempotent (no duplicate items). Backs KeychainSecretStore.
  "broker/keychain-exec.ts": ["process"],
  // The 0600 file fallback for the secret vault (road-to-real-breadth P0), used
  // when the macOS keychain is unavailable. Owner-only JSON file; single fixed
  // path (no garbage). The persistence write/read for KeychainSecretStore's peer.
  "broker/file-secret-store.ts": ["fs-read", "fs-write"],
  // Read-only GitHub CLI (road-to-real-breadth P0). execFile `gh`, no shell; a
  // mutating-verb guard refuses pr create/merge/close + `api -X`. Reads PRs under
  // the user's existing gh login (no token in this process). Backs RealForgeProvider.
  "task-forge/gh-exec.ts": ["process"],
  // Read-only Jira REST client (road-to-real-breadth P0) — the first `fetch`
  // egress primitive (explicit review). GET-only, fixed Jira base URL, token
  // injected via ProviderAuth at the execution layer (secret-by-reference).
  "task-forge/jira-http.ts": ["fetch"],
  // Read-only Sentry Web API client (SENTRY-BACKEND-SPEC §2). GET-only, Bearer
  // token via ProviderAuth (secret-by-reference). `fetch` egress (explicit review).
  "observability/sentry-http.ts": ["fetch"],
  // Read-only Linear GraphQL client (road-to-real-breadth P0, second task
  // backend). GraphQL is POST even for reads, so this is a `fetch` egress
  // primitive (explicit review) — but it REFUSES any `mutation` document, so it
  // can only query. Token injected via ProviderAuth (secret-by-reference).
  "task-forge/linear-http.ts": ["fetch"],
  // IDE self-telemetry store (real-breadth P3): local, opt-in, scrubbed event
  // log. A first-party fs primitive like recent-projects — atomic write + read,
  // holds no SecretStore (cannot leak the vault), no untrusted-derived egress.
  "telemetry/telemetry-store.ts": ["fs-read", "fs-write"],
  // The system-`git` exec primitive (B1). execFile, no shell.
  "git/git-exec.ts": ["process"],
  // The quality-tool runner (B5) shells out to eslint/tsc/vitest. execFile.
  "quality/real-quality-provider.ts": ["process"],
  // The ACP agent transport (B3) spawns the agent child process.
  "acp/acp-transport.ts": ["process"],
  // The NATIVE Claude-Code stream-json transport (B8 P2a) — the sealed `claude`
  // child process (stream-json mode). Same posture as `acp-transport.ts`:
  // SEALED spawn (credential-free env allowlist, piped stderr). The model's
  // tool_use blocks are the only consequential actions, every one routed
  // through the broker by `claude-code-provider.ts` — there is no direct
  // fs/shell/net edge here.
  "acp/claude-stream-exec.ts": ["process"],
  // The READ-ONLY backend-detection primitive (B8 P0) — `which`/`--version`
  // probes only. execFile, no shell. It mutates nothing; its mutating-arg guard
  // refuses any install verb. The only spawn outside the broker that is
  // read-only by construction.
  "provision/detect-exec.ts": ["process"],
  // The agent-tooling INSTALL primitive (B8 P1) — the mutating spawn (e.g.
  // `npm i -g …`). execFile, no shell. Its SOLE caller is the broker-gated
  // installer (`install-broker.ts`), which runs it only inside `broker.execute`.
  // A denied capability never reaches this file → no install.
  "provision/install-exec.ts": ["process"],
  // The RTK observation-compressor primitive (token-economy Phase 3) — spawns
  // the external `rtk` Rust binary (execFile, no shell, argv array; raw output
  // on stdin → compressed stdout). RTK is a READ-shaped transform (text→text,
  // mutates nothing) and is the LLM-OBSERVATION path only; its output is branded
  // LlmFacingOnly and the broker/audit refuse it (AK-T1/T2). Missing binary →
  // clean degrade to `undefined`, never a hard-fail.
  "rtk/rtk-exec.ts": ["process"],
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
  // The `.git/info/exclude` primitive (local-artifact-hygiene P1/P2) — the
  // audited `node:fs` home for the idempotent marked-block read + write that
  // keeps Capisco's project-local files out of the consumer's Git. Its WRITE is
  // reached ONLY through the broker-gated adapter (`git-exclude-broker.ts`)
  // inside `broker.execute`; a denied capability never reaches the write. The
  // read half (existsSync/readFileSync of `.git/info/exclude` + the no-repo
  // probe) is read-only.
  "git/git-exclude-exec.ts": ["fs-read", "fs-write"],
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
