/**
 * Queue-drain hook (P5-A). Fires `fireNext` once each time the session's
 * completion counter increments — and never on the initial mount baseline. The
 * counter is bumped only by `completeRun` (not `cancelRun`), so a Stop never
 * drains; this test drives the counter directly (the honest seam).
 */

import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useQueueDrain } from "./use-queue-drain.ts";

describe("useQueueDrain", () => {
  it("does not fire on the initial mount (baseline)", () => {
    const fire = vi.fn();
    renderHook(() => useQueueDrain("s1", 0, fire));
    expect(fire).not.toHaveBeenCalled();
  });

  it("fires once per completion increment", () => {
    const fire = vi.fn();
    const { rerender } = renderHook(({ n }) => useQueueDrain("s1", n, fire), {
      initialProps: { n: 0 },
    });
    rerender({ n: 1 });
    expect(fire).toHaveBeenCalledTimes(1);
    rerender({ n: 2 });
    expect(fire).toHaveBeenCalledTimes(2);
  });

  it("does not fire when the counter is unchanged (a re-render alone)", () => {
    const fire = vi.fn();
    const { rerender } = renderHook(({ n }) => useQueueDrain("s1", n, fire), {
      initialProps: { n: 3 },
    });
    rerender({ n: 3 });
    expect(fire).not.toHaveBeenCalled();
  });

  it("keeps a per-session baseline (switching sessions never spuriously drains)", () => {
    const fire = vi.fn();
    const { rerender } = renderHook(({ id, n }) => useQueueDrain(id, n, fire), {
      initialProps: { id: "s1", n: 5 },
    });
    // Switch to a different session whose counter is already non-zero — this is
    // a fresh baseline, not an increment, so no drain.
    rerender({ id: "s2", n: 2 });
    expect(fire).not.toHaveBeenCalled();
    // Now s2 actually completes.
    rerender({ id: "s2", n: 3 });
    expect(fire).toHaveBeenCalledTimes(1);
  });
});
