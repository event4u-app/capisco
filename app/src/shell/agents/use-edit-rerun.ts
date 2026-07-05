import { useMemo, useRef } from "react";

/**
 * Edit-&-Rerun-as-branch (Agent-Cockpit P5-A). Tracks whether the composer's
 * current buffer came from a history recall (↑-on-empty, P4). When the user
 * edits a recalled prompt and sends, the send path forks a **retry branch**
 * (`SessionTree.branch()`, never overwrites) labelled "retry · edited" instead
 * of a plain send — so re-running a past prompt preserves the original as a
 * sibling.
 *
 * Pure imperative (a single `useRef`, no React state → no re-renders). The
 * caller wires `onRecallEnter` into `useHistoryRecall`'s `onEnter` and
 * `onRecallExit` into its `onExit`, clears it when the field is emptied, and
 * reads `branchLabel()` in the send path.
 *
 * The flag SURVIVES edits — recalling a prompt and then editing it is exactly
 * the rerun case. It clears only on send, on recall-exit (↓ past newest /
 * Escape restores the empty buffer), or when the field is emptied.
 */
export interface EditRerunHandle {
  /** True while the buffer is a recalled prompt being edited for rerun. */
  readonly active: boolean;
  /** The branch label to fork under on send, or null when not a rerun. */
  branchLabel(): string | null;
  /** Recall activated (↑-on-empty) — the buffer is now a recalled prompt. */
  onRecallEnter(): void;
  /** Recall exited or the field emptied — no longer a rerun. */
  onRecallExit(): void;
  /** A send fired — clear the flag (the next buffer starts fresh). */
  onSend(): void;
}

/** The branch label a rerun send forks under. */
export const RERUN_BRANCH_LABEL = "retry · edited";

export function useEditRerun(): EditRerunHandle {
  const activeRef = useRef(false);
  return useMemo(
    () => ({
      get active() {
        return activeRef.current;
      },
      branchLabel() {
        return activeRef.current ? RERUN_BRANCH_LABEL : null;
      },
      onRecallEnter() {
        activeRef.current = true;
      },
      onRecallExit() {
        activeRef.current = false;
      },
      onSend() {
        activeRef.current = false;
      },
    }),
    [],
  );
}
