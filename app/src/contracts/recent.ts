/**
 * Cross-IDE Recent-Projects registry contract (B0 Phase 2, overview §6).
 *
 * The resolution of the cross-IDE-linking feature note is deliberately minimal:
 * **no daemon, no socket mesh, no multi-root LSP.** Instead a single passive,
 * machine-wide file in user-config records the projects recently opened by *any*
 * Capisco instance. Each running instance appends/refreshes its own entry; the
 * project switcher reads the file to surface other instances/projects for
 * reference and jump — without loading two projects into one window.
 *
 * Concurrency is handled by atomic writes (write-temp + rename) and an
 * append-merge on the entry keyed by `path`, so two instances writing at once
 * never corrupt the file. The richer "use knowledge from project A's session in
 * B" is explicitly NOT here — it is a broker-scoped cross-project session search
 * (a B3 follow-up), gated to prevent foreign project context leaking into a
 * cloud prompt (§3.2).
 */

/** One recently-opened project recorded by some Capisco instance. */
export interface RecentProject {
  /** Absolute filesystem path of the project root (the merge key). */
  path: string;
  /** Display name (defaults to the basename of `path`). */
  name: string;
  /** Branch the instance had checked out when it last touched the entry. */
  branch?: string;
  /**
   * Monotonic last-touched ordinal (the writing instance's logical clock). The
   * registry is sorted most-recent-first by this value. Deliberately an opaque
   * ordinal, not a wall-clock, so the store stays deterministic in tests.
   */
  lastSeen: number;
  /**
   * Stable id of the instance that owns this entry (so the switcher can show
   * "open in another window" vs "this window"). Never a secret.
   */
  instanceId: string;
  /** Whether the owning instance is currently live (best-effort, advisory). */
  active?: boolean;
}

/**
 * The passive recent-projects registry. The sidecar implements it against the
 * machine-wide file; the real and fake share this contract. The UI project
 * switcher consumes `list()` and surfaces entries owned by other instances.
 */
export interface RecentProjectsProvider {
  /** Every recorded project, most-recent-first. */
  list(): Promise<RecentProject[]>;
  /**
   * Record (or refresh) the calling instance's entry for `path`. Merges by
   * `path`: an existing entry is updated in place (new branch / bumped
   * `lastSeen`), never duplicated. Resolves to the written entry.
   */
  touch(entry: {
    path: string;
    name?: string;
    branch?: string;
    instanceId: string;
    active?: boolean;
  }): Promise<RecentProject>;
  /** Mark an instance's entries inactive (on shutdown). Resolves count cleared. */
  release(instanceId: string): Promise<number>;
}
