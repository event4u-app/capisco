import { create } from "zustand";
import type { GitWorktreeEntry } from "@/contracts";
import { getProviders } from "@/lib/desktop-shell";
import { useOpenProject } from "@/shell/open-project-store";

/**
 * Worktree-runtime store (road-to-runnable-dev P3). Lists, creates, and switches
 * git worktrees for the currently open repo, and starts a (stub) agent session
 * in a chosen worktree — all against the live sidecar `worktree-ops` + `session`
 * providers. Like the P1/P2 stores it only does real work when a project is
 * open (dev-runtime); in the mock/visual harness no component drives it, so the
 * goldens are untouched.
 *
 * Worktree paths default to a `.capisco-worktrees/<branch>` sibling of the repo
 * root — kept inside a predictable dir so the explorer ignore-set and GC can
 * reason about them.
 */

interface WorktreeStore {
  /** Worktrees of the open repo (main + linked), as the sidecar lists them. */
  worktrees: GitWorktreeEntry[];
  /** The selected/active worktree path (defaults to the repo root / main). */
  activePath: string;
  /** In-flight flag for a create/list/start op. */
  busy: boolean;
  /** Last error surfaced inline. */
  error: string | null;
  /** Session id started for the active worktree (P3 micro-north-star), if any. */
  startedSessionId: string | null;
  /** Refresh the worktree list for the open repo. */
  refresh(): Promise<void>;
  /** Create a NEW worktree + branch under the repo's `.capisco-worktrees/`. */
  createWorktree(branch: string): Promise<GitWorktreeEntry | null>;
  /** Select a worktree as the active one (the place a session would run in). */
  setActive(path: string): void;
  /**
   * Start a stub agent session in the active worktree (P3). Resolves the
   * store session id. The run is broker-gated server-side (the agent can only
   * act through the chokepoint).
   */
  startSession(prompt: string): Promise<string | null>;
}

/** Default checkout dir for a new worktree, a predictable sibling of the root. */
function worktreePathFor(repoRoot: string, branch: string): string {
  const safe = branch.replace(/[^A-Za-z0-9._-]/g, "-");
  return `${repoRoot}/.capisco-worktrees/${safe}`;
}

export const useWorktrees = create<WorktreeStore>((set, get) => ({
  worktrees: [],
  activePath: "",
  busy: false,
  error: null,
  startedSessionId: null,
  refresh: async () => {
    const project = useOpenProject.getState().project;
    if (!project) return;
    set({ busy: true, error: null });
    try {
      const worktrees = await getProviders().worktree.list(project.path);
      set((s) => ({
        worktrees,
        busy: false,
        activePath: s.activePath || project.path,
      }));
    } catch (err) {
      set({
        busy: false,
        error: err instanceof Error ? err.message : "failed to list worktrees",
      });
    }
  },
  createWorktree: async (branch: string) => {
    const project = useOpenProject.getState().project;
    if (!project) return null;
    set({ busy: true, error: null });
    try {
      const path = worktreePathFor(project.path, branch);
      const entry = await getProviders().worktree.create(project.path, path, {
        branch,
        newBranch: true,
      });
      const worktrees = await getProviders().worktree.list(project.path);
      set({ worktrees, busy: false, activePath: entry.path });
      return entry;
    } catch (err) {
      set({
        busy: false,
        error: err instanceof Error ? err.message : "failed to create worktree",
      });
      return null;
    }
  },
  setActive: (path: string) => set({ activePath: path }),
  startSession: async (prompt: string) => {
    const { activePath } = get();
    const project = useOpenProject.getState().project;
    const worktreePath = activePath || project?.path;
    if (!worktreePath) {
      set({ error: "no worktree selected" });
      return null;
    }
    set({ busy: true, error: null });
    try {
      // The session store creates the run coupled to the worktree. The ToDo /
      // ACP path drives the agent; here we record the run a session would attach
      // to (a real agent run is the ToDo→agent path or the dev-bridge ACP swap).
      const session = await getProviders().session.create({
        model: "Stub Agent",
        title: prompt,
        status: "running",
        worktreePath,
      });
      set({ busy: false, startedSessionId: session.id });
      return session.id;
    } catch (err) {
      set({
        busy: false,
        error: err instanceof Error ? err.message : "failed to start session",
      });
      return null;
    }
  },
}));
