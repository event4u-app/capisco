/**
 * Real WorktreeOpsProvider (B2, road-to-worktree-runtime) — the production swap
 * for the worktree primitive. Shells out to `git worktree add/list/remove/prune`
 * via the same no-shell {@link git} helper as B1 (decision: shell-out over
 * isomorphic-git; system git is present, hermetic against temp repos, zero new
 * deps). Parses `git worktree list --porcelain`.
 *
 * Session coupling (§2.1) is tracked in-process: git itself has no notion of a
 * Capisco session, so the provider remembers which worktree path belongs to
 * which session id. On GC, a session whose worktree directory vanished (crash)
 * is released. The coupling map is keyed by absolute path.
 */

import type {
  CreateWorktreeOptions,
  GitWorktreeEntry,
  RemoveWorktreeOptions,
  WorktreeGcResult,
  WorktreeOpsProvider,
} from "@/contracts";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { git } from "./git-exec.ts";

/** Parse `git worktree list --porcelain` into structured entries. */
export function parseWorktreeList(stdout: string): Omit<GitWorktreeEntry, "sessionId" | "isMain">[] {
  const entries: Omit<GitWorktreeEntry, "sessionId" | "isMain">[] = [];
  let cur: Partial<Omit<GitWorktreeEntry, "sessionId" | "isMain">> | null = null;

  const flush = () => {
    if (cur && cur.path) {
      entries.push({
        path: cur.path,
        head: cur.head ?? "",
        branch: cur.branch,
        detached: cur.detached ?? false,
        prunable: cur.prunable ?? false,
      });
    }
    cur = null;
  };

  for (const raw of stdout.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line === "") {
      // Blank line terminates a worktree block.
      flush();
      continue;
    }
    const sp = line.indexOf(" ");
    const key = sp === -1 ? line : line.slice(0, sp);
    const val = sp === -1 ? "" : line.slice(sp + 1);
    cur ??= {};
    switch (key) {
      case "worktree":
        // A new block may start without a preceding blank line in some git
        // versions; flush the previous one first.
        if (cur.path) {
          flush();
          cur = {};
        }
        cur.path = val;
        break;
      case "HEAD":
        cur.head = val;
        break;
      case "branch":
        // e.g. "refs/heads/feature-x" → short "feature-x"
        cur.branch = val.replace(/^refs\/heads\//, "");
        break;
      case "detached":
        cur.detached = true;
        break;
      case "prunable":
        cur.prunable = true;
        break;
      // "bare", "locked" etc. are ignored — not part of the contract shape.
    }
  }
  flush();
  return entries;
}

export class RealWorktreeProvider implements WorktreeOpsProvider {
  /** path (absolute, resolved) → sessionId. The §2.1 coupling git cannot store. */
  private readonly coupling = new Map<string, string>();

  /**
   * Canonical path key. git reports the real (symlink-resolved) path — on macOS
   * `/var/…` resolves to `/private/var/…` — so we resolve symlinks for both
   * sides when the path exists, falling back to `resolve` for paths that no
   * longer exist on disk (a pruned/crashed worktree).
   */
  private key(path: string): string {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  }

  async create(
    repoCwd: string,
    path: string,
    options: CreateWorktreeOptions,
  ): Promise<GitWorktreeEntry> {
    const args = ["worktree", "add"];
    if (options.newBranch) {
      args.push("-b", options.branch, path);
      if (options.base) args.push(options.base);
    } else {
      args.push(path, options.branch);
    }
    await git(repoCwd, args);

    if (options.sessionId) {
      this.coupling.set(this.key(path), options.sessionId);
    }

    const list = await this.list(repoCwd);
    const made = list.find((w) => this.key(w.path) === this.key(path));
    if (!made) {
      // Should never happen — git reported success but the entry is absent.
      throw new Error(`worktree add succeeded but ${path} not found in list`);
    }
    return made;
  }

  async list(repoCwd: string): Promise<GitWorktreeEntry[]> {
    const { stdout } = await git(repoCwd, ["worktree", "list", "--porcelain"]);
    const parsed = parseWorktreeList(stdout);
    // The first entry git reports is always the main worktree.
    return parsed.map((e, i) => ({
      ...e,
      isMain: i === 0,
      sessionId: this.coupling.get(this.key(e.path)),
    }));
  }

  async remove(
    repoCwd: string,
    path: string,
    options: RemoveWorktreeOptions = {},
  ): Promise<void> {
    const args = ["worktree", "remove"];
    if (options.force) args.push("--force");
    args.push(path);
    await git(repoCwd, args);
    this.coupling.delete(this.key(path));
  }

  async gc(repoCwd: string): Promise<WorktreeGcResult> {
    // Which couplings point at a worktree git considers prunable (its directory
    // vanished) — capture BEFORE pruning so we can release those sessions.
    const before = await this.list(repoCwd);
    const prunablePaths = new Set(before.filter((w) => w.prunable).map((w) => this.key(w.path)));

    const releasedSessions: string[] = [];
    for (const [path, sessionId] of this.coupling) {
      if (prunablePaths.has(path)) {
        releasedSessions.push(sessionId);
        this.coupling.delete(path);
      }
    }

    // `git worktree prune` drops git's stale administrative entries. `--verbose`
    // prints "Removing worktrees/<id>: <reason>" but the canonical truth of what
    // was pruned is the set of prunable entries we measured above.
    await git(repoCwd, ["worktree", "prune"]);

    return {
      pruned: before.filter((w) => w.prunable).map((w) => w.path),
      releasedSessions,
    };
  }
}
