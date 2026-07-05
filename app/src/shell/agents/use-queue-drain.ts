import { useEffect, useRef } from "react";

/**
 * Message-queue drain (Agent-Cockpit P5-A). Fires the next queued message for a
 * session when that session's run COMPLETES — detected via the store's
 * per-session `runCompletions` counter (bumped only by `completeRun`, never by
 * `cancelRun`). Watching the counter, not `runState`, is what keeps a Stop from
 * draining the queue: both settle `runState` to "ready", but only a natural
 * completion bumps the counter.
 *
 * `completion` is `runCompletions[sessionId] ?? 0`. On each increment the hook
 * calls `fireNext()` once — the caller dequeues the head and sends it. The
 * initial value is recorded on mount so a remount never spuriously drains.
 *
 * NOTE: the live `subscribe('done') → completeRun` wire lands with the
 * real-runtime track; until then nothing calls `completeRun` in the browser
 * mock path (a mock run never finishes on its own), so the queue does not
 * auto-drain live yet. The drain LOGIC here is exercised directly against
 * `completeRun` in tests — no faked completion event.
 */
export function useQueueDrain(
  sessionId: string,
  completion: number,
  fireNext: () => void,
): void {
  // Per-session last-seen completion count. Keyed so switching sessions never
  // carries a stale baseline (which would drop or double-fire a drain).
  const seenRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const seen = seenRef.current;
    const prev = seen[sessionId];
    if (prev === undefined) {
      // First time we observe this session — record the baseline, never drain.
      seen[sessionId] = completion;
      return;
    }
    if (completion > prev) {
      seen[sessionId] = completion;
      fireNext();
    }
  }, [sessionId, completion, fireNext]);
}
