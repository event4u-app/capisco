import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { StallWatchdog } from "../acp/stall-watchdog.ts";

/**
 * road-to-real-runtime P4 — the agent stall watchdog, deterministic with fake
 * timers (no real `claude` run needed; the live leg is credentials-gated).
 */
describe("StallWatchdog", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires after the timeout when no activity arrives", () => {
    let fired = 0;
    const w = new StallWatchdog(1000, () => fired++);
    w.start();
    vi.advanceTimersByTime(999);
    expect(fired).toBe(0);
    vi.advanceTimersByTime(1);
    expect(fired).toBe(1);
    expect(w.fired).toBe(true);
  });

  it("kick() resets the timer — an active run never stalls", () => {
    let fired = 0;
    const w = new StallWatchdog(1000, () => fired++);
    w.start();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(900);
      w.kick();
    }
    expect(fired).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(fired).toBe(1);
  });

  it("fires at most once; kick() after firing is a no-op", () => {
    let fired = 0;
    const w = new StallWatchdog(1000, () => fired++);
    w.start();
    vi.advanceTimersByTime(1000);
    expect(fired).toBe(1);
    w.kick();
    vi.advanceTimersByTime(5000);
    expect(fired).toBe(1);
  });

  it("stop() before the timeout prevents firing (clean finish)", () => {
    let fired = 0;
    const w = new StallWatchdog(1000, () => fired++);
    w.start();
    vi.advanceTimersByTime(500);
    w.stop();
    vi.advanceTimersByTime(5000);
    expect(fired).toBe(0);
  });
});
