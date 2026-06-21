/**
 * Deterministic browser mock {@link WorktreeOpsProvider} (road-to-runnable-dev
 * P3). The browser/visual fallback for the real git-worktree primitive: a
 * disk-free in-memory model so the Vite-only app + the Playwright visual specs
 * stay functional offline. The real swap is
 * `sidecar/git/real-worktree-provider.ts` (shells out to `git worktree …`),
 * wired by the dev bridge. No Date.now / Math.random — a monotonic counter
 * mints deterministic heads.
 */

import type {
  CreateWorktreeOptions,
  GitWorktreeEntry,
  WorktreeGcResult,
  WorktreeOpsProvider,
} from "@/contracts";

let seq = 0;

/** In-memory worktree model keyed by repoCwd → entries (the main + linked). */
class MockWorktreeProvider implements WorktreeOpsProvider {
  readonly #byRepo = new Map<string, GitWorktreeEntry[]>();

  #repo(repoCwd: string): GitWorktreeEntry[] {
    let list = this.#byRepo.get(repoCwd);
    if (!list) {
      // The main worktree always exists (git init creates it).
      list = [
        {
          path: repoCwd,
          branch: "main",
          head: `mock${++seq}`,
          isMain: true,
          detached: false,
          prunable: false,
        },
      ];
      this.#byRepo.set(repoCwd, list);
    }
    return list;
  }

  create(
    repoCwd: string,
    path: string,
    options: CreateWorktreeOptions,
  ): Promise<GitWorktreeEntry> {
    const list = this.#repo(repoCwd);
    const entry: GitWorktreeEntry = {
      path,
      branch: options.branch,
      head: `mock${++seq}`,
      isMain: false,
      detached: false,
      prunable: false,
      sessionId: options.sessionId,
    };
    list.push(entry);
    return Promise.resolve({ ...entry });
  }

  list(repoCwd: string): Promise<GitWorktreeEntry[]> {
    return Promise.resolve(this.#repo(repoCwd).map((e) => ({ ...e })));
  }

  remove(repoCwd: string, path: string): Promise<void> {
    const list = this.#repo(repoCwd);
    const idx = list.findIndex((e) => e.path === path && !e.isMain);
    if (idx >= 0) list.splice(idx, 1);
    return Promise.resolve();
  }

  gc(): Promise<WorktreeGcResult> {
    // The mock never crashes a worktree, so there is nothing to prune.
    return Promise.resolve({ pruned: [], releasedSessions: [] });
  }
}

export const mockWorktreeProvider: WorktreeOpsProvider = new MockWorktreeProvider();
