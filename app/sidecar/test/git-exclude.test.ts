// @vitest-environment node
/**
 * Local-artifact-hygiene integration test (road-to-local-artifact-hygiene).
 *
 * Hermetic against `git init` temp repos (B1/B2 pattern). Proves the four hard
 * acceptance criteria:
 *
 *  - AK-G1 broker-mediated fs write — the `.git/info/exclude` write flows through
 *    `broker.execute`; the append-only audit records it.
 *  - AK-G2 transparency — the first write per repo goes through the `ask` gate
 *    (the visible confirmation); a deny-all gate writes nothing.
 *  - AK-G3 idempotent, marked block, no `.gitignore` touch — one marked block;
 *    second run = no-op (no second audit/disk change); `.gitignore` untouched.
 *  - AK-G4 no-repo safe — a dir without `.git` does nothing, no throw, no `.git/`.
 *  - `core.excludesFile` respected — a repo with it set is surfaced, not assumed.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AuditEntry } from "@/contracts";
import { Broker } from "../broker/capability-broker.ts";
import {
  BrokerExcludeWriter,
  EXCLUDE_TARGET,
  type ExcludeResolver,
  type GlobalExcludesReader,
} from "../git/git-exclude-broker.ts";
import {
  EXCLUDE_BLOCK_START,
  EXCLUDE_BLOCK_END,
  readExcludeState,
  renderBlock,
  resolveGitDir,
} from "../git/git-exclude-exec.ts";
import {
  CAPISCO_EXCLUDED_PATHS,
  CAPISCO_LOCAL_DIR,
  CAPISCO_CACHE_DIR,
  CAPISCO_SHARED_PROJECT_FILE,
  isExcludedArtifact,
  localArtifactPath,
  cacheArtifactPath,
} from "../local/project-paths.ts";
import { makeTempRepo, type TempRepo } from "./git-temp-repo.ts";

/** A clearing resolver — stands in for the human OK at the first write. */
const CLEAR: ExcludeResolver = () => ({ axis: "session" });
/** A deny-all resolver — the fail-closed default. */
const DENY: ExcludeResolver = () => ({ axis: "deny" });
/** No global excludesFile by default — injected so the test stays spawn-free. */
const NO_GLOBAL: GlobalExcludesReader = () => Promise.resolve(undefined);

function makeWriter(
  broker: Broker,
  resolve: ExcludeResolver = CLEAR,
  readGlobalExcludes: GlobalExcludesReader = NO_GLOBAL,
): BrokerExcludeWriter {
  return new BrokerExcludeWriter({ broker, resolvePermission: resolve, readGlobalExcludes });
}

let repo: TempRepo;

beforeEach(() => {
  repo = makeTempRepo();
  repo.write(".gitignore", "node_modules/\ndist/\n");
  repo.commitAll("init");
});

afterEach(() => {
  repo.cleanup();
});

function excludePath(): string {
  return join(repo.dir, ".git", "info", "exclude");
}
function readExclude(): string {
  return existsSync(excludePath()) ? readFileSync(excludePath(), "utf8") : "";
}

describe("Phase 0 — single project-local path (.capisco/)", () => {
  it("excludes ONLY the personal subpaths, never the shared project.toml", () => {
    expect(CAPISCO_EXCLUDED_PATHS).toEqual([`${CAPISCO_LOCAL_DIR}/`, `${CAPISCO_CACHE_DIR}/`]);
    // The shared file is deliberately NOT excluded (stays versioned).
    expect(CAPISCO_EXCLUDED_PATHS).not.toContain(CAPISCO_SHARED_PROJECT_FILE);
    expect(CAPISCO_EXCLUDED_PATHS.some((p) => p.includes("project.toml"))).toBe(false);
  });

  it("resolves personal artifacts under .capisco/local and .capisco/cache", () => {
    expect(localArtifactPath("layout.json")).toBe(".capisco/local/layout.json");
    expect(cacheArtifactPath("symbols.bin")).toBe(".capisco/cache/symbols.bin");
  });

  it("classifies personal artifacts as excluded, shared config as not", () => {
    expect(isExcludedArtifact(".capisco/local/layout.json")).toBe(true);
    expect(isExcludedArtifact(".capisco/cache/x")).toBe(true);
    expect(isExcludedArtifact(CAPISCO_SHARED_PROJECT_FILE)).toBe(false);
    expect(isExcludedArtifact("src/app.ts")).toBe(false);
  });

  it("rejects an artifact name that escapes the .capisco subtree", () => {
    expect(() => localArtifactPath("../../etc/passwd")).toThrow(/escapes/);
    expect(() => cacheArtifactPath("/abs")).toThrow(/escapes/);
  });
});

describe("Phase 1 — idempotent .git/info/exclude write (broker-gated)", () => {
  it("writes the marked block through the broker; the audit records the write", async () => {
    const broker = new Broker();
    const outcome = await makeWriter(broker).ensureExcluded(repo.dir);

    expect(outcome.hasRepo).toBe(true);
    expect(outcome.wrote).toBe(true);

    // The marked block is on disk, covering exactly the personal subpaths.
    const content = readExclude();
    expect(content).toContain(EXCLUDE_BLOCK_START);
    expect(content).toContain(EXCLUDE_BLOCK_END);
    expect(content).toContain(`${CAPISCO_LOCAL_DIR}/`);
    expect(content).toContain(`${CAPISCO_CACHE_DIR}/`);
    expect(content).not.toContain("project.toml");

    // AK-G1 — the write flowed through broker.execute (append-only audit).
    const executed = broker.audit.list().filter((e: AuditEntry) => e.outcome === "executed");
    expect(executed.length).toBe(1);
    expect(executed[0].capability).toBe("file-write");
    expect(executed[0].target).toBe(EXCLUDE_TARGET);
  });

  it("is idempotent — a second run is a no-op (no disk change, no new audit)", async () => {
    const broker = new Broker();
    const writer = makeWriter(broker);

    const first = await writer.ensureExcluded(repo.dir);
    expect(first.wrote).toBe(true);
    const afterFirst = readExclude();

    const second = await writer.ensureExcluded(repo.dir);
    expect(second.wrote).toBe(false);
    expect(second.reason).toMatch(/idempotent/);

    // Byte-identical — the second run touched nothing.
    expect(readExclude()).toBe(afterFirst);

    // No SECOND executed audit entry (the idempotent no-op never reached the broker).
    const executed = broker.audit.list().filter((e: AuditEntry) => e.outcome === "executed");
    expect(executed.length).toBe(1);
  });

  it("does NOT touch the team's .gitignore", async () => {
    const before = readFileSync(join(repo.dir, ".gitignore"), "utf8");
    await makeWriter(new Broker()).ensureExcluded(repo.dir);
    expect(readFileSync(join(repo.dir, ".gitignore"), "utf8")).toBe(before);
  });

  it("preserves pre-existing non-Capisco lines in exclude verbatim", async () => {
    // A user already has a hand-written exclude line.
    const writer = makeWriter(new Broker());
    // Seed an existing exclude via git's own dir (write through the real path is
    // broker-gated, but the test seeds the raw file to simulate a pre-existing one).
    const seeded = "*.log\n.DS_Store\n";
    repo.git(["config", "--local", "core.bare", "false"]); // ensure normal repo
    rmSync(excludePath(), { force: true });
    // Write the seed directly with fs (test infra is allowed to).
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync(join(repo.dir, ".git", "info"), { recursive: true });
    writeFileSync(excludePath(), seeded, "utf8");

    await writer.ensureExcluded(repo.dir);
    const content = readExclude();
    expect(content).toContain("*.log");
    expect(content).toContain(".DS_Store");
    expect(content).toContain(EXCLUDE_BLOCK_START);
  });

  it("upgrades a stale block when Capisco adds a new artifact path", async () => {
    // Seed an OLD block missing the cache path.
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync(join(repo.dir, ".git", "info"), { recursive: true });
    const staleBlock = [EXCLUDE_BLOCK_START, `${CAPISCO_LOCAL_DIR}/`, EXCLUDE_BLOCK_END].join("\n") + "\n";
    writeFileSync(excludePath(), staleBlock, "utf8");

    const outcome = await makeWriter(new Broker()).ensureExcluded(repo.dir);
    expect(outcome.wrote).toBe(true);
    const content = readExclude();
    // Both paths present now, and only ONE block (no duplicate markers).
    expect(content).toContain(`${CAPISCO_CACHE_DIR}/`);
    expect(content.match(new RegExp(EXCLUDE_BLOCK_START, "g"))?.length).toBe(1);
  });
});

describe("AK-G2 — transparency / human gate", () => {
  it("a deny-all gate writes NOTHING (no disk change, no executed audit)", async () => {
    const broker = new Broker();
    const before = readExclude();
    const outcome = await makeWriter(broker, DENY).ensureExcluded(repo.dir);

    expect(outcome.wrote).toBe(false);
    expect(outcome.denied).toBe(true);
    // Byte-identical: a real `git init` ships a default `.git/info/exclude`; the
    // deny-all gate must leave it exactly as-is (no Capisco block appended).
    expect(readExclude()).toBe(before);
    expect(readExclude()).not.toContain(EXCLUDE_BLOCK_START);

    const executed = broker.audit.list().filter((e: AuditEntry) => e.outcome === "executed");
    expect(executed.length).toBe(0);
  });

  it("the write goes through an ask gate (audit shows the authorize ask)", async () => {
    const broker = new Broker();
    await makeWriter(broker).ensureExcluded(repo.dir);
    const asked = broker.audit.list().filter((e: AuditEntry) => e.outcome === "ask");
    expect(asked.some((e) => e.target === EXCLUDE_TARGET)).toBe(true);
  });
});

describe("Phase 2 — edge cases", () => {
  it("AK-G4 — a directory with no .git does nothing, no throw, creates no .git", async () => {
    const bare = mkdtempSync(join(tmpdir(), "capisco-norepo-"));
    try {
      const broker = new Broker();
      const outcome = await makeWriter(broker).ensureExcluded(bare);
      expect(outcome.hasRepo).toBe(false);
      expect(outcome.wrote).toBe(false);
      // Never created a .git directory.
      expect(existsSync(join(bare, ".git"))).toBe(false);
      // Never touched the broker (nothing to authorize).
      expect(broker.audit.list().length).toBe(0);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("resolveGitDir returns undefined for a non-repo, the git dir for a repo", () => {
    const bare = mkdtempSync(join(tmpdir(), "capisco-norepo2-"));
    try {
      expect(resolveGitDir(bare)).toBeUndefined();
      expect(resolveGitDir(repo.dir)).toBeDefined();
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it("respects a user core.excludesFile — surfaces it instead of assuming", async () => {
    const globalPath = "/home/dev/.config/git/ignore";
    const broker = new Broker();
    const outcome = await makeWriter(broker, CLEAR, () => Promise.resolve(globalPath)).ensureExcluded(
      repo.dir,
    );
    // We still write our repo-local block (double-covering does no harm), but the
    // global is reported so the caller knows it is not the only voice.
    expect(outcome.globalExcludesFile).toBe(globalPath);
    expect(outcome.wrote).toBe(true);
  });

  it("reads exclude state without writing (read-only probe is no-op on disk)", () => {
    const before = readExclude();
    const state = readExcludeState(repo.dir, CAPISCO_EXCLUDED_PATHS);
    expect(state.hasRepo).toBe(true);
    expect(state.blockPresent).toBe(false);
    expect(readExclude()).toBe(before);
  });

  it("renderBlock produces the exact start/paths/end shape", () => {
    expect(renderBlock([".capisco/local/", ".capisco/cache/"])).toBe(
      `${EXCLUDE_BLOCK_START}\n.capisco/local/\n.capisco/cache/\n${EXCLUDE_BLOCK_END}`,
    );
  });
});
