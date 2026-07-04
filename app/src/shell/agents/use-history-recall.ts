import { useRef, useMemo } from "react";

/**
 * Handle returned by `useHistoryRecall`. The consumer wires `onKeyDown` into
 * the textarea's `onKeyDown` handler and calls `reset()` whenever the session
 * switches (or the prompt log resets).
 */
export interface HistoryRecallHandle {
  /**
   * Process a keydown event on the textarea. Returns `true` when the event was
   * consumed (arrow navigation inside the history log); the caller MUST return
   * early from its own handler in that case.
   *
   * @param e   The keydown event (React synthetic or native — only `key` +
   *            `preventDefault` are used).
   * @param el  The underlying field element (uncontrolled pattern).
   * @param currentValue  The current textarea value at the time of the event.
   */
  onKeyDown(
    e: { key: string; preventDefault(): void },
    el: HTMLTextAreaElement | HTMLInputElement,
    currentValue: string,
  ): boolean;
  /**
   * Reset cursor state (call when the session switches or after a successful
   * send so stale recall state never bleeds across sessions).
   */
  reset(): void;
}

/**
 * Pure imperative cursor for keyboard-driven prompt history recall
 * (input reliability P4). Uses only `React.useRef` internally — no React state
 * means no re-renders on every keystroke; the textarea remains fully
 * uncontrolled.
 *
 * `log` is the full prompt history in **most-recent-LAST** order (matches the
 * `sessionPromptLog` selector). `onExit` is called whenever recall mode exits
 * (so the caller can dismiss a "browsing history" indicator, for example).
 */
export function useHistoryRecall(log: string[], onExit?: () => void): HistoryRecallHandle {
  /** Current cursor into `log`. null = not in recall mode. */
  const cursorRef = useRef<number | null>(null);
  /** Buffer saved when recall starts so we can restore it on Escape / ↓ past end. */
  const savedBufferRef = useRef<string>("");

  return useMemo(
    () => ({
      onKeyDown(
        e: { key: string; preventDefault(): void },
        el: HTMLTextAreaElement | HTMLInputElement,
        currentValue: string,
      ): boolean {
        const inRecall = cursorRef.current !== null;

        if (e.key === "ArrowUp") {
          if (!inRecall) {
            // Only enter recall when the field is empty.
            if (currentValue !== "") return false;
            if (log.length === 0) return false;
            // Save the current (empty) buffer and jump to the newest entry.
            savedBufferRef.current = currentValue;
            cursorRef.current = log.length - 1;
            el.value = log[cursorRef.current]!;
            // Move caret to end.
            el.setSelectionRange(el.value.length, el.value.length);
            e.preventDefault();
            return true;
          } else {
            // Already in recall — step backward (toward older entries).
            // `inRecall` guarantees cursorRef.current is non-null here.
            const next = cursorRef.current! - 1;
            if (next < 0) {
              // Already at the oldest entry; stay put.
              e.preventDefault();
              return true;
            }
            cursorRef.current = next;
            el.value = log[next]!;
            el.setSelectionRange(el.value.length, el.value.length);
            e.preventDefault();
            return true;
          }
        }

        if (e.key === "ArrowDown" && inRecall) {
          const next = cursorRef.current! + 1;
          if (next >= log.length) {
            // Past the newest entry — exit recall and restore the saved buffer.
            el.value = savedBufferRef.current;
            el.setSelectionRange(el.value.length, el.value.length);
            cursorRef.current = null;
            onExit?.();
            e.preventDefault();
            return true;
          }
          cursorRef.current = next;
          el.value = log[cursorRef.current]!;
          el.setSelectionRange(el.value.length, el.value.length);
          e.preventDefault();
          return true;
        }

        if (e.key === "Escape" && inRecall) {
          // Restore saved buffer, exit recall, let Escape propagate (the caller
          // may want to close a panel etc.).
          el.value = savedBufferRef.current;
          el.setSelectionRange(el.value.length, el.value.length);
          cursorRef.current = null;
          onExit?.();
          return false;
        }

        // Any printable character while in recall: silently exit recall so
        // the user can start typing freely. The keystroke itself is NOT
        // consumed — the browser will append it to the textarea.
        if (inRecall && e.key.length === 1) {
          cursorRef.current = null;
          return false;
        }

        return false;
      },

      reset() {
        cursorRef.current = null;
        savedBufferRef.current = "";
      },
    }),
    // The handle is referentially stable across re-renders unless `log` changes.
    // `log` is the live dependency: a new array reference (on each store update)
    // intentionally replaces the handle so callers always see the freshest log.
    [log, onExit],
  );
}
