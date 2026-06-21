/**
 * Real-git provider wiring (B1, road-to-real-git). The thin swap promised by
 * register-mocks.ts: instead of the deterministic mock workspace/git providers,
 * register the real shell-out implementations against a concrete worktree path.
 *
 * The default sidecar boot still uses the mocks (deterministic UI parity); this
 * registration is what a real deployment / the integration tests call to put a
 * live repo behind the same `workspace` + `gitops` registry ids. Same contracts,
 * same wire surface — no UI consumer can tell the difference.
 */

import type { ProviderRegistry } from "./registry/registry.ts";
import { RealGitProvider } from "./git/real-git-provider.ts";
import { RealWorkspaceProvider } from "./git/real-workspace-provider.ts";
import { RealWorktreeProvider } from "./git/real-worktree-provider.ts";
import { PROVIDER_IDS } from "./register-mocks.ts";

/** The primitive git-porcelain provider id on the wire. */
export const GITOPS_PROVIDER_ID = "gitops";

/** The git-worktree primitive provider id on the wire (B2). */
export const WORKTREE_PROVIDER_ID = "worktree-ops";

export interface RegisterGitOptions {
  /** Worktree root the workspace + gitops providers operate on. */
  cwd: string;
  repoId?: string;
  repoName?: string;
}

/**
 * Register the real `workspace` provider (UI-facing projection) and the `gitops`
 * provider (primitive porcelain) on a registry. Throws if `workspace` is already
 * taken — call this on a fresh registry, or register the mocks selectively.
 */
export function registerGitProviders(
  registry: ProviderRegistry,
  opts: RegisterGitOptions,
): {
  git: RealGitProvider;
  workspace: RealWorkspaceProvider;
  worktree: RealWorktreeProvider;
} {
  const git = new RealGitProvider();
  const workspace = new RealWorkspaceProvider({
    cwd: opts.cwd,
    git,
    repoId: opts.repoId,
    repoName: opts.repoName,
  });
  const worktree = new RealWorktreeProvider();
  registry.register(PROVIDER_IDS.workspace, workspace as never);
  registry.register(GITOPS_PROVIDER_ID, git as never);
  registry.register(WORKTREE_PROVIDER_ID, worktree as never);
  return { git, workspace, worktree };
}
