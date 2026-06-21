/**
 * Worktree-operation contract (B2, road-to-worktree-runtime, §2.1).
 *
 * Git worktrees are the "place" primitive: an agent run gets its OWN checkout of
 * the repo at its OWN path on its OWN branch, isolated and reviewable. The
 * worktree lifecycle == the session lifecycle (Council note: the diff from an
 * agent run "falls out for free" because each run lives in its own worktree).
 *
 * This is the *primitive* surface (create / list / remove + crash GC), distinct
 * from the UI-facing {@link WorkspaceProvider} which projects a single worktree's
 * status into Explorer/Changes shapes. The real impl shells out to
 * `git worktree …`; a hermetic substrate drives it against `git init` temp repos
 * (no new dependency, real porcelain, machine-independent).
 *
 * Security note (B4 lookahead): like {@link GitOpsProvider}, every method is a
 * first-party `git` execution the broker will later mediate — it is not an
 * open-ended shell escape, only `git worktree` subcommands flow through it.
 */

/** One linked worktree as reported by `git worktree list --porcelain`. */
export interface GitWorktreeEntry {
  /** Absolute filesystem path of the checkout. */
  path: string;
  /** Branch the worktree has checked out (short name), or undefined if detached. */
  branch?: string;
  /** HEAD commit the worktree points at (full hash). */
  head: string;
  /** True for the repo's main worktree (the one `git init`/`clone` created). */
  isMain: boolean;
  /** True when the worktree is detached (no branch). */
  detached: boolean;
  /** True when the worktree's path is missing on disk (a "prunable" entry). */
  prunable: boolean;
  /**
   * The session this worktree is coupled to (§2.1: worktree lifecycle ==
   * session lifecycle). Tracked by the provider, not by git itself; undefined
   * for worktrees git knows about that Capisco did not create for a session
   * (e.g. the main worktree, or one made outside the app).
   */
  sessionId?: string;
}

/** Options for {@link WorktreeOpsProvider.create}. */
export interface CreateWorktreeOptions {
  /**
   * Branch to check out in the new worktree. With `newBranch`, the branch is
   * created (from `base` if given, else current HEAD); without it, an existing
   * branch is checked out.
   */
  branch: string;
  /** Create `branch` as a new branch (`git worktree add -b`). */
  newBranch?: boolean;
  /** Base ref the new branch starts from (only with `newBranch`). */
  base?: string;
  /**
   * Couple the new worktree to a session (§2.1). Recorded by the provider so
   * GC and listing can reason about which worktrees belong to which run.
   */
  sessionId?: string;
}

/** Options for {@link WorktreeOpsProvider.remove}. */
export interface RemoveWorktreeOptions {
  /** Force removal even if the worktree has local modifications. */
  force?: boolean;
}

/** What {@link WorktreeOpsProvider.gc} cleaned up. */
export interface WorktreeGcResult {
  /**
   * Paths of worktrees that were pruned: their checkout directory vanished
   * (crashed/deleted out from under git) so git's administrative entry was
   * stale. These are the "GC on crash" cleanups (§2.1).
   */
  pruned: string[];
  /**
   * Session ids whose coupling was dropped because the worktree backing them no
   * longer exists. Lets the session store release the orphaned run.
   */
  releasedSessions: string[];
}

/**
 * Real git-worktree primitive (B2). Create an isolated checkout for a run, list
 * what exists (with session coupling), remove one when its session ends, and GC
 * the worktrees orphaned by a crash. Every method is keyed by the repo's
 * working directory (`repoCwd`) — the path of the *main* worktree / repo root.
 */
export interface WorktreeOpsProvider {
  /**
   * Create a worktree at `path` (a fresh directory, typically under a
   * `.worktrees/` sibling of the repo). Resolves the created entry, including
   * its `sessionId` coupling if one was given.
   */
  create(
    repoCwd: string,
    path: string,
    options: CreateWorktreeOptions,
  ): Promise<GitWorktreeEntry>;
  /**
   * List every worktree of the repo (main + linked), each tagged with its
   * Capisco session coupling where one is tracked.
   */
  list(repoCwd: string): Promise<GitWorktreeEntry[]>;
  /**
   * Remove the worktree at `path` (`git worktree remove`) and drop its session
   * coupling. The main worktree cannot be removed (git refuses).
   */
  remove(repoCwd: string, path: string, options?: RemoveWorktreeOptions): Promise<void>;
  /**
   * Garbage-collect worktrees orphaned by a crash: `git worktree prune` drops
   * git's stale administrative entries for checkouts whose directory vanished,
   * and the provider releases any session coupled to a now-missing worktree
   * (§2.1 "GC bei Crash"). Idempotent.
   */
  gc(repoCwd: string): Promise<WorktreeGcResult>;
}
