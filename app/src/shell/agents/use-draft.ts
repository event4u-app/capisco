import { useState, useLayoutEffect, useRef, useCallback } from "react";

/** Debounce delay (ms) for persisting the draft on every input event. */
const DEBOUNCE_MS = 400;

interface UseDraftOpts {
  /** Ref to the textarea / input whose value is the draft. */
  ref: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  /** Active session id — changing this triggers a restore of the matching draft. */
  sessionId: string;
  /**
   * The already-persisted draft for `sessionId` (from the store). Empty string
   * signals no draft to restore. Changing `sessionId` (not `initialDraft`)
   * drives the restore — the layout effect is keyed on `sessionId`.
   */
  initialDraft: string;
  /** Store action to persist the current body. */
  saveDraft: (id: string, body: string) => void;
}

interface UseDraftReturn {
  /** Wire to the textarea's `onInput` event to trigger debounced persistence. */
  onInput: () => void;
  /**
   * True while a restored draft banner should be shown. The consumer calls
   * `dismissRestored()` when the user acknowledges or starts typing.
   */
  draftRestored: boolean;
  dismissRestored: () => void;
}

/**
 * Draft persistence + restore for the composer textarea (input reliability P4).
 *
 * Session-switch path (keyed on `sessionId`):
 *   If `initialDraft` is non-empty → populate the textarea's `.value`, move the
 *   caret to end, set `draftRestored = true`, and fire a synthetic `input` event
 *   so the auto-grow hook re-measures the field before paint.
 *   If `initialDraft` is empty → leave the textarea's `.value` alone and ensure
 *   `draftRestored` is false (golden-safe: no visual change on a fresh session).
 *
 * Input path:
 *   Every `onInput` call arms a 400 ms debounce that calls `saveDraft`. The
 *   timer is cleared on unmount.
 */
export function useDraft({
  ref,
  sessionId,
  initialDraft,
  saveDraft,
}: UseDraftOpts): UseDraftReturn {
  const [draftRestored, setDraftRestored] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore the draft (or clear the flag) whenever the active session switches.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (initialDraft) {
      el.value = initialDraft;
      el.setSelectionRange(el.value.length, el.value.length);
      // setState inside useLayoutEffect is intentional here: we want the
      // "draft restored" banner to appear in the same paint cycle as the
      // textarea value restoration, avoiding a one-frame flash.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraftRestored(true);
      // Notify the auto-grow hook and any other listeners that the value changed.
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      setDraftRestored(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Cleanup the debounce timer on unmount.
  useLayoutEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const onInput = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const el = ref.current;
      if (el) saveDraft(sessionId, el.value);
    }, DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, saveDraft]);

  const dismissRestored = useCallback(() => setDraftRestored(false), []);

  return { onInput, draftRestored, dismissRestored };
}
