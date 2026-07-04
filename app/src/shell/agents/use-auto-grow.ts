import { useLayoutEffect, useCallback } from "react";

/** Maximum textarea height before the box scrolls internally (px). */
const MAX_GROW_HEIGHT_PX = 320;

/**
 * Auto-sizes a textarea to fit its content up to `MAX_GROW_HEIGHT_PX`
 * (input reliability P4). Returns a stable `measure` callback that callers
 * invoke on every input event.
 *
 * Design notes:
 * - Absolutely no min-height is set in JS; the textarea's CSS `rows` / the
 *   `.cmp-ta` class governs the empty-state height.
 * - `measure()` is safe to call on an empty textarea — it collapses to `"auto"`
 *   first, then reads `scrollHeight`, so it never fights the CSS default.
 * - The `useLayoutEffect` fires once per session switch (when the ref is
 *   assigned / when a draft is restored) to size the field before paint.
 */
export function useAutoGrow(ref: React.RefObject<HTMLTextAreaElement | null>): {
  measure: () => void;
} {
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const capped = Math.min(el.scrollHeight, MAX_GROW_HEIGHT_PX);
    el.style.height = `${capped}px`;
    el.style.overflowY = el.scrollHeight > MAX_GROW_HEIGHT_PX ? "auto" : "hidden";
  }, [ref]);

  // Sync once after mount / after a draft is restored (layout pass before paint
  // so there is no flicker when a multi-line draft is populated).
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  return { measure };
}
