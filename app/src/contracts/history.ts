/**
 * History-2 shadow-store contract (§5.1) — the "an agent shredded my file"
 * rescue net. A local, append-only snapshot store SEPARATE from git: every
 * Save and every detected external change records a content snapshot so any
 * prior state of a file is recoverable even when it was never committed.
 *
 * This is an interface + deterministic fake (B-pre). The real implementation
 * (content-addressed local store) is a thin swap behind the same contract.
 */

/** Why a snapshot was taken — the two triggers §5.1 names. */
export type SnapshotReason = "save" | "external";

/** One immutable point-in-time snapshot of a file's full content. */
export interface Snapshot {
  id: string;
  /** File path the snapshot belongs to. */
  file: string;
  /** Full file content at snapshot time (content-addressed in the real store). */
  content: string;
  /** What triggered the snapshot. */
  reason: SnapshotReason;
  /** Monotonic sequence index (deterministic ordering; no wall-clock in the fake). */
  seq: number;
  /** Human label for the timeline (e.g. "Save", "External change"). */
  label: string;
}

/**
 * The shadow store. Append-only: `record` adds a snapshot, nothing mutates or
 * deletes prior snapshots. Distinct from git history — it captures uncommitted
 * intermediate states so an agent's destructive edit is always recoverable.
 */
export interface ShadowStore {
  /** Record a new snapshot of `file`'s `content` for `reason`. Resolves to it. */
  record(file: string, content: string, reason: SnapshotReason): Promise<Snapshot>;
  /** All snapshots for a file, oldest → newest (append order). */
  list(file: string): Promise<Snapshot[]>;
  /** A single snapshot by id, or null. */
  get(id: string): Promise<Snapshot | null>;
  /** The content to restore for a snapshot id (the rescue path), or null. */
  restore(id: string): Promise<string | null>;
}
