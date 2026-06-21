/**
 * Primitive git-operation contract (B1, road-to-real-git).
 *
 * The existing {@link GitProvider} (workspace.ts) is the GitHub-style PR/DORA
 * **dashboard** surface; this `GitOpsProvider` is the *local* git porcelain the
 * Explorer/Changes/Commit/Diff/Log/Blame views drive: status, diffs (working /
 * staged / branch-vs-base), log, blame, branch list — and the write half:
 * stage, unstage, commit, branch create/checkout.
 *
 * It is async because the real implementation shells out to `git` (decision in
 * DECISIONS.md: shell-out over isomorphic-git — system git is present, hermetic
 * against temp repos, zero new deps). Every method is keyed by a `cwd` working
 * directory so a single provider can serve multiple worktrees of multiple repos.
 *
 * The shapes are deliberately small and git-faithful (porcelain v2 / numstat),
 * not pre-rendered: the UI-facing {@link DiffDoc}/{@link ChangeSet} mapping is a
 * thin projection on top (see RealWorkspaceProvider in the sidecar).
 */

/** Porcelain status code for one path, split into staged (index) + unstaged (worktree). */
export type GitStatusCode =
  | "M" // modified
  | "A" // added
  | "D" // deleted
  | "R" // renamed
  | "C" // copied
  | "U" // unmerged / conflicted
  | "?" // untracked
  | "!" // ignored
  | "."; // unchanged on that side

/** One entry of `git status` for a path. `staged`/`unstaged` are the two XY columns. */
export interface GitStatusEntry {
  path: string;
  /** Original path for a rename/copy (the `->` source), else undefined. */
  origPath?: string;
  /** Index (staged) state. */
  staged: GitStatusCode;
  /** Worktree (unstaged) state. */
  unstaged: GitStatusCode;
}

/** Result of `git status` for a worktree. */
export interface GitStatus {
  /** Current branch name, or a detached-HEAD marker like "(detached)". */
  branch: string;
  /** Upstream tracking branch, if any (e.g. "origin/main"). */
  upstream?: string;
  /** Commits ahead of upstream. */
  ahead: number;
  /** Commits behind upstream. */
  behind: number;
  /** True when there are no tracked changes and no untracked files. */
  clean: boolean;
  entries: GitStatusEntry[];
}

/** A line-level diff hunk, faithful to unified-diff. */
export interface GitDiffHunk {
  /** The `@@ -oldStart,oldLines +newStart,newLines @@` header. */
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  /** Raw unified-diff body lines (prefixed by ' ', '+', '-'). */
  lines: string[];
}

/** A per-file diff. `binary` files carry no hunks. */
export interface GitFileDiff {
  /** New path (or path for unchanged-name files). */
  path: string;
  /** Old path for renames, else equal to `path`. */
  oldPath: string;
  status: GitStatusCode;
  added: number;
  removed: number;
  binary: boolean;
  hunks: GitDiffHunk[];
}

/** Which diff to compute. */
export interface GitDiffOptions {
  /** Staged (index-vs-HEAD) instead of working-tree-vs-index. */
  staged?: boolean;
  /** Diff a single path only. */
  path?: string;
  /**
   * Diff the current state against a base ref (branch-vs-base). When set,
   * `staged` is ignored — this is a ref..worktree comparison.
   */
  base?: string;
}

/** One commit from `git log`. */
export interface GitLogEntry {
  hash: string;
  shortHash: string;
  author: string;
  authorEmail: string;
  /** Author date as a Unix epoch-seconds string (caller renders; no Date.now). */
  date: string;
  subject: string;
  /** Parent hashes (≥2 → merge commit). */
  parents: string[];
}

export interface GitLogOptions {
  /** Limit the number of commits (default 50). */
  limit?: number;
  /** Log a single path only. */
  path?: string;
  /** Start ref (default HEAD). */
  ref?: string;
}

/** One line of `git blame`. */
export interface GitBlameLine {
  hash: string;
  shortHash: string;
  author: string;
  /** Author date as Unix epoch-seconds string. */
  date: string;
  /** 1-based line number in the final file. */
  lineNo: number;
  content: string;
}

/** A branch as listed by `git branch`. */
export interface GitBranch {
  name: string;
  current: boolean;
  /** Tip commit short hash. */
  tip: string;
  /** Upstream tracking branch, if any. */
  upstream?: string;
}

/** Result of a write op (commit/checkout/branch) — the resulting HEAD/branch. */
export interface GitWriteResult {
  ok: true;
  /** New HEAD short hash (commit) or current branch (checkout/branch). */
  ref: string;
}

/**
 * Local git porcelain provider (B1). Read half + write half. The real impl
 * shells out to `git -C <cwd>`; a hermetic test substrate drives it against
 * `git init` temp repos. No method renders for the UI — the WorkspaceProvider
 * projects these shapes into {@link DiffDoc}/{@link ChangeSet}/etc.
 */
export interface GitOpsProvider {
  /** True iff `cwd` is inside a git work tree. */
  isRepo(cwd: string): Promise<boolean>;
  /** `git status` for the worktree at `cwd`. */
  status(cwd: string): Promise<GitStatus>;
  /** Per-file diffs (working / staged / branch-vs-base). */
  diff(cwd: string, options?: GitDiffOptions): Promise<GitFileDiff[]>;
  /** Commit history. */
  log(cwd: string, options?: GitLogOptions): Promise<GitLogEntry[]>;
  /** Line-by-line blame for a tracked file. */
  blame(cwd: string, path: string): Promise<GitBlameLine[]>;
  /** All local branches. */
  branches(cwd: string): Promise<GitBranch[]>;
  /** Current branch name (or detached marker). */
  currentBranch(cwd: string): Promise<string>;

  // --- write half ---
  /** Stage paths (`git add`). Empty list stages everything (`git add -A`). */
  stage(cwd: string, paths: string[]): Promise<void>;
  /** Unstage paths (`git restore --staged`). Empty list unstages everything. */
  unstage(cwd: string, paths: string[]): Promise<void>;
  /** Commit the staged index. Optionally set the author identity for hermetic tests. */
  commit(cwd: string, message: string, author?: GitAuthor): Promise<GitWriteResult>;
  /** Create a branch (optionally from a base ref); does not check it out. */
  branchCreate(cwd: string, name: string, base?: string): Promise<GitWriteResult>;
  /** Checkout an existing branch/ref; `create` makes-and-switches in one step. */
  checkout(cwd: string, ref: string, create?: boolean): Promise<GitWriteResult>;
}

/** Author identity for a commit (hermetic tests pin this; real use reads git config). */
export interface GitAuthor {
  name: string;
  email: string;
}
