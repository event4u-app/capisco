/**
 * Dev workspace wiring (road-to-runnable-dev P1/P2) — puts the REAL on-disk
 * project provider behind the `projectFs` wire id so the dev bridge serves a
 * live file tree + real file content for whatever repo the UI opens, a
 * broker-gated editor SAVE (P2), and (when a default repo root is configured)
 * swaps the real git/workspace/worktree providers in for it too.
 *
 * `projectFs` is path-keyed (every method takes the repo root), so a single
 * real instance serves any project the UI opens at runtime — no
 * per-open re-registration. The unix-socket sidecar keeps the deterministic
 * mock; this real swap is dev-bridge-only.
 *
 * The editor-save write is wired through {@link BrokerFsWriter}: the disk touch
 * runs only inside `broker.execute`. The default config marks `file-write` as
 * `ask`; a Save is HUMAN-initiated trusted intent, so the dev resolver clears
 * the gate per session (the human's return-channel decision — it does NOT
 * widen the allowlist config). Without a broker, writes stay gated.
 */

import type { CapabilityBroker } from "@/contracts";
import type { ProviderRegistry } from "./registry/registry.ts";
import { RealGitProvider } from "./git/real-git-provider.ts";
import { RealWorkspaceProvider } from "./git/real-workspace-provider.ts";
import { RealWorktreeProvider } from "./git/real-worktree-provider.ts";
import { RealFsProvider } from "./fs/real-fs-provider.ts";
import { BrokerFsWriter } from "./fs/fs-write-broker.ts";
import { BrokerExcludeWriter } from "./git/git-exclude-broker.ts";
import { GITOPS_PROVIDER_ID, WORKTREE_PROVIDER_ID } from "./register-git.ts";
import { PROVIDER_IDS } from "./register-mocks.ts";

export interface RegisterDevWorkspaceOptions {
  /** Default repo root to put live git/workspace/worktree behind the ids. */
  repo?: string;
  /**
   * The capability broker (B4). When given, the editor-save write is
   * broker-gated through it; absent, saves are reported gated (no disk write).
   */
  broker?: CapabilityBroker;
}

/**
 * Replace the mock `projectFs` with the real fs+git provider. When `repo` is
 * given, also swap the real git/workspace/worktree providers rooted at it. When
 * `broker` is given, the editor save is broker-gated (the disk write runs only
 * inside `broker.execute`). Idempotent on a registry where the mocks were
 * registered first. A bare string second arg is accepted as the repo path
 * (back-compat).
 */
export function registerDevWorkspace(
  registry: ProviderRegistry,
  opts: RegisterDevWorkspaceOptions | string = {},
): void {
  const { repo, broker } =
    typeof opts === "string" ? { repo: opts, broker: undefined } : opts;
  const git = new RealGitProvider();
  if (repo) {
    // Real git/workspace for the configured repo, replacing the mocks.
    const workspace = new RealWorkspaceProvider({ cwd: repo, git });
    registry.replace(PROVIDER_IDS.workspace, workspace as never);
    registry.replace(GITOPS_PROVIDER_ID, git as never);
  }
  // Always serve the REAL worktree primitive (P3). Every method is keyed by the
  // repo working dir, so one instance serves whichever repo the UI opens at
  // runtime — like `projectFs`, no per-open re-registration. The git/workspace
  // swap above still needs a configured default repo (it is cwd-bound), but
  // worktree ops are path-keyed and work for any opened project.
  registry.replace(WORKTREE_PROVIDER_ID, new RealWorktreeProvider() as never);
  // The broker-gated editor-save writer (P2). A Save is human-initiated trusted
  // intent, so the dev resolver clears the `ask` gate for the session — never a
  // config widening, just the human's return-channel decision per the run.
  const writer = broker
    ? new BrokerFsWriter({ broker, resolvePermission: () => ({ axis: "session" }) })
    : undefined;
  // Always serve the REAL fs provider (path-keyed) so the UI can open any
  // project at runtime via the path input, whether or not a default repo is set.
  registry.replace(PROVIDER_IDS.projectFs, new RealFsProvider(git, writer) as never);

  // Local-artifact hygiene: when a `repo` is configured, keep Capisco's personal
  // project-local files (`.capisco/local/`, `.capisco/cache/`) out of the
  // consumer's Git via an idempotent `.git/info/exclude` marked block. The write
  // is broker-gated (the `ask` IS the first-time visible confirmation); a Save-
  // style session resolver clears it. No-repo / already-excluded are safe no-ops.
  // Best-effort: a denied gate or no repo never blocks opening the project.
  if (repo && broker) {
    const excludeWriter = new BrokerExcludeWriter({
      broker,
      resolvePermission: () => ({ axis: "session" }),
    });
    void excludeWriter.ensureExcluded(repo).catch(() => {
      /* hygiene is best-effort; never fail the dev-workspace boot on it */
    });
  }
}
