/**
 * Broker-gated `.git/info/exclude` writer (road-to-local-artifact-hygiene
 * Phase 1/2).
 *
 * Writing the marked block into `.git/info/exclude` is a MUTATING filesystem
 * write — it flows through the broker chokepoint (B4) exactly like an editor
 * save (`fs-write-broker.ts`) or an install (`install-broker.ts`). It is NOT an
 * allowlisted read-only operation; the default grant config marks `file-write`
 * as `ask` (AK-G1). The `ask` IS the one-time visible confirmation the first
 * write per repo requires — never silent in `.git/` (AK-G2).
 *
 *   authorize(file-write .git/info/exclude)  →  [ask → human-gate]  →  execute(write)
 *
 * The write is HUMAN-initiated trusted intent (Capisco opening a project and
 * offering to keep its local files out of Git) — no `fromUntrusted` flag; the
 * lethal-trifecta gate does not apply. No secret is involved.
 *
 * Flow specifics:
 *  - **No repo** → returns `{ hasRepo:false, wrote:false }` WITHOUT touching the
 *    broker (nothing to authorize, AK-G4 — never creates `.git/`).
 *  - **Block already complete** → returns `{ wrote:false }` WITHOUT touching the
 *    broker (idempotent no-op, AK-G3 — no spurious audit/ask on a second run).
 *  - **Block missing/partial** → authorize → (ask) gate → execute; the disk
 *    write runs ONLY inside `broker.execute`. A denied gate → `wrote:false`, no
 *    disk change.
 *  - **`core.excludesFile`** → read once (read-only `git config`) and surfaced in
 *    the outcome so the caller can note "also covered globally" instead of
 *    assuming Capisco is the only voice.
 */

import type {
  BrokerDecision,
  CapabilityBroker,
  CapabilityRequest,
  PermissionDecision,
  Principal,
} from "@/contracts";
import { git } from "./git-exec.ts";
import {
  ensureExcludeBlockWrite,
  readExcludeState,
} from "./git-exclude-exec.ts";
import { CAPISCO_EXCLUDED_PATHS } from "../local/project-paths.ts";

/** Human-in-the-loop gate for the exclude write. Defaults to deny-all. */
export type ExcludeResolver = (
  request: CapabilityRequest,
) => Promise<PermissionDecision> | PermissionDecision;

/** Fail-closed default: no write without an explicit resolver. */
const DENY_ALL: ExcludeResolver = () => ({ axis: "deny" });

/** The human principal a cleared exclude write executes as (§3.1). */
const HUMAN: Principal = { id: "human", kind: "human", label: "You" };

/** The audited capability target — what the allowlist + audit log record. */
export const EXCLUDE_TARGET = ".git/info/exclude";

/** A reader for `core.excludesFile` — injectable so tests stay spawn-free. */
export type GlobalExcludesReader = (root: string) => Promise<string | undefined>;

/**
 * Read the user's `git config core.excludesFile` via the system-git READ-ONLY
 * primitive. Returns undefined when unset / git errors. The single `git config`
 * lookup site — kept here (not in the fs primitive) so the process chokepoint
 * stays single-sourced through `git-exec.ts`.
 */
async function readCoreExcludesFile(root: string): Promise<string | undefined> {
  try {
    const { stdout } = await git(root, ["config", "--get", "core.excludesFile"], {
      allowFail: true,
    });
    const value = stdout.trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export interface ExcludeBrokerOptions {
  broker: CapabilityBroker;
  /** Human-gate resolver (defaults to deny-all). The IDE clears it per repo. */
  resolvePermission?: ExcludeResolver;
  /** Personal artifact paths to exclude (defaults to the Phase-0 personal set). */
  excludedPaths?: readonly string[];
  /** `core.excludesFile` reader (defaults to the read-only git-config lookup). */
  readGlobalExcludes?: GlobalExcludesReader;
}

export interface ExcludeOutcome {
  /** False when there is no `.git` repo (AK-G4 — nothing done, no throw). */
  hasRepo: boolean;
  /** True only when the marked block was actually written this call. */
  wrote: boolean;
  /** False when an `ask` gate denied the write (no disk change). */
  denied?: boolean;
  /** Absolute path written (when known). */
  excludePath?: string;
  /** The user's `core.excludesFile`, surfaced for transparency (never written). */
  globalExcludesFile?: string;
  /** A short, human-readable reason for a no-op / denial. */
  reason?: string;
}

/**
 * The broker-gated `.git/info/exclude` writer. `ensureExcluded(root)` runs the
 * full no-repo / idempotency check then authorize → gate → execute path; the
 * disk write happens ONLY inside `broker.execute`. Verify hermetically against
 * `git init` temp repos.
 */
export class BrokerExcludeWriter {
  readonly #broker: CapabilityBroker;
  readonly #resolve: ExcludeResolver;
  readonly #paths: readonly string[];
  readonly #readGlobal: GlobalExcludesReader;

  constructor(opts: ExcludeBrokerOptions) {
    this.#broker = opts.broker;
    this.#resolve = opts.resolvePermission ?? DENY_ALL;
    this.#paths = opts.excludedPaths ?? CAPISCO_EXCLUDED_PATHS;
    this.#readGlobal = opts.readGlobalExcludes ?? readCoreExcludesFile;
  }

  async ensureExcluded(root: string): Promise<ExcludeOutcome> {
    const globalExcludesFile = await this.#readGlobal(root);

    // 1. No-repo + idempotency pre-checks WITHOUT touching the broker — a second
    //    run on an already-excluded repo must not spawn a spurious audit/ask.
    const state = readExcludeState(root, this.#paths, globalExcludesFile);
    if (!state.hasRepo) {
      return { hasRepo: false, wrote: false, reason: "no git repo", globalExcludesFile };
    }
    if (state.blockPresent) {
      return {
        hasRepo: true,
        wrote: false,
        excludePath: state.excludePath,
        globalExcludesFile,
        reason: "already excluded (idempotent no-op)",
      };
    }

    // 2. Authorize the mutating fs write (writes the append-only audit BEFORE any
    //    disk touch). The default config returns `ask` for `file-write`.
    const request: CapabilityRequest = { kind: "file-write", target: EXCLUDE_TARGET };
    const decision = this.#broker.authorize(HUMAN, request);
    if (decision.outcome === "deny") {
      return {
        hasRepo: true,
        wrote: false,
        denied: true,
        excludePath: state.excludePath,
        globalExcludesFile,
        reason: `exclude write denied: ${decision.reason}`,
      };
    }

    // 3. On `ask`, the human gate decides — this IS the one-time visible
    //    confirmation (AK-G2). A deny-all resolver leaves `.git/` untouched.
    let execDecision: BrokerDecision = decision;
    if (decision.outcome === "ask") {
      const human = await this.#resolve(request);
      this.#broker.resolve(HUMAN, request, human);
      if (human.axis === "deny") {
        return {
          hasRepo: true,
          wrote: false,
          denied: true,
          excludePath: state.excludePath,
          globalExcludesFile,
          reason: "exclude write denied by human gate",
        };
      }
      // C3 — re-authorize on the human's authority to mint the execution grant.
      execDecision = this.#broker.authorize(HUMAN, request);
      if (execDecision.outcome !== "allow") {
        return {
          hasRepo: true,
          wrote: false,
          denied: true,
          excludePath: state.excludePath,
          globalExcludesFile,
          reason: "exclude write gate not cleared",
        };
      }
    }

    // 4. EXECUTE through the chokepoint — the idempotent block write is the
    //    perform side effect, run ONLY inside this callback with the single-use
    //    grant. A denied capability never reaches here → no disk change.
    const result = this.#broker.execute(
      HUMAN,
      request,
      () => ensureExcludeBlockWrite(root, this.#paths),
      { grant: execDecision.grant },
    );

    return {
      hasRepo: result.hasRepo,
      wrote: result.wrote,
      excludePath: result.excludePath ?? state.excludePath,
      globalExcludesFile,
      reason: result.wrote ? "marked block written" : "no change",
    };
  }
}
