/**
 * Scoped-grant bulk-run preview contract (matrix P1, item 229).
 *
 * When the agent is about to perform many `file-write`s, the human can grant one
 * task-bound scoped grant ("N writes under `<prefix>/` for this task") instead of
 * approving each write. Before granting, the UI shows a PATTERN-COVERAGE PREVIEW:
 * which of the pending writes the grant would cover, and which fall outside the
 * prefix and therefore stay single-gated. This is the frontend seam — the
 * pending-writes feed is a deterministic mock today (see `mocks/scoped-grant.ts`);
 * the real feed is the agent's look-ahead of planned writes (gated on the real
 * run-loop). The actual ENFORCEMENT lives in the sidecar broker
 * (`policy-engine.scopeMatches` + `maxActions` + `revokeTask`, already shipped).
 */

/** One planned `file-write` the agent intends to perform under the current task. */
export interface PendingWriteIntent {
  /** The issuing task (a scoped grant is bound to it). */
  taskId: string;
  /** Repo-relative path, shown to the human (the audit label). */
  relTarget: string;
  /** Absolute, realpath-canonicalised target — what the prefix check compares. */
  canonicalTarget: string;
}

/**
 * The result of previewing a scoped grant of `pathPrefix` against a set of
 * pending writes: which are covered (would clear under the grant) vs which fall
 * outside the prefix (stay single-gated). `maxActions` is the suggested budget.
 */
export interface GrantPreview {
  /** Absolute, canonical directory prefix the grant would cover. */
  pathPrefix: string;
  /** Pending writes whose canonical target is under `pathPrefix`. */
  covered: PendingWriteIntent[];
  /** Pending writes outside `pathPrefix` — NOT covered, remain single-gated. */
  outOfScope: PendingWriteIntent[];
  /** Suggested action budget (defaults to the covered count, min 1). */
  maxActions: number;
}
