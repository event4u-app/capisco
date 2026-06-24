/**
 * Code-hunk revert contract (road-to-composer-context-runtime P4, threat-pass
 * `agents/contexts/file-ingestion-contract.md` §6).
 *
 * Revert discards the working-tree change to ONE path — the git-authoritative
 * `git checkout -- <path>` — and NOTHING else. It is NEVER a side-effect undo
 * (no un-sending an email, no un-running a command): the honesty boundary is
 * named in the label and the audit. It runs through the broker (a `file-write`
 * capability) and the first-party `git` exec primitive (`execFile`, argv array,
 * no shell — a path with shell metacharacters can never inject; test 6).
 *
 * Disabled when the session has no worktree (the outcome is `skipped` with an
 * honest reason — never a fake "reverted").
 */

export type RevertOutcome =
  | { status: "reverted"; path: string }
  | { status: "skipped"; reason: string };

export interface RevertProvider {
  /**
   * Discard the working-tree change to `path` within the worktree at `cwd`,
   * via the broker-gated git-authoritative checkout. Returns `skipped` (never
   * throws to the UI) when `cwd` is not a worktree.
   */
  revertPath(cwd: string, path: string): Promise<RevertOutcome>;
}
