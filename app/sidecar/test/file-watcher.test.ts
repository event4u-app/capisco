import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FileWatcher, type OsWatcher, type WatchFn, type WatchEvent } from "../fs/file-watcher.ts";

/** A fake OS watch the test drives directly — no real filesystem. */
function fakeWatch(): { watchFn: WatchFn; emit: (t: string, f: string | null) => void; closed: () => boolean } {
  let cb: ((t: string, f: string | null) => void) | null = null;
  let isClosed = false;
  const watchFn: WatchFn = (_root, onRaw) => {
    cb = onRaw;
    const os: OsWatcher = { close: () => (isClosed = true) };
    return os;
  };
  return { watchFn, emit: (t, f) => cb?.(t, f), closed: () => isClosed };
}

describe("FileWatcher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces many raw events for one path into a single change", () => {
    const fake = fakeWatch();
    const events: WatchEvent[] = [];
    const w = new FileWatcher({ watchFn: fake.watchFn, debounceMs: 80 });
    w.watch("/repo", (e) => events.push(e));

    fake.emit("change", "src/app.ts");
    fake.emit("change", "src/app.ts");
    fake.emit("change", "src/app.ts");
    expect(events).toEqual([]); // nothing yet (within debounce window)
    vi.advanceTimersByTime(80);
    expect(events).toEqual([{ path: "src/app.ts", type: "change" }]);
  });

  it("ignores node_modules / .git / dist churn", () => {
    const fake = fakeWatch();
    const events: WatchEvent[] = [];
    const w = new FileWatcher({ watchFn: fake.watchFn, debounceMs: 10 });
    w.watch("/repo", (e) => events.push(e));

    fake.emit("change", "node_modules/react/index.js");
    fake.emit("change", ".git/HEAD");
    fake.emit("change", "dist/bundle.js");
    fake.emit("change", "src/real.ts");
    vi.advanceTimersByTime(10);
    expect(events).toEqual([{ path: "src/real.ts", type: "change" }]);
  });

  it("reports rename events distinctly", () => {
    const fake = fakeWatch();
    const events: WatchEvent[] = [];
    const w = new FileWatcher({ watchFn: fake.watchFn, debounceMs: 5 });
    w.watch("/repo", (e) => events.push(e));
    fake.emit("rename", "src/moved.ts");
    vi.advanceTimersByTime(5);
    expect(events).toEqual([{ path: "src/moved.ts", type: "rename" }]);
  });

  it("separate paths each get their own debounced event", () => {
    const fake = fakeWatch();
    const events: WatchEvent[] = [];
    const w = new FileWatcher({ watchFn: fake.watchFn, debounceMs: 20 });
    w.watch("/repo", (e) => events.push(e));
    fake.emit("change", "a.ts");
    fake.emit("change", "b.ts");
    vi.advanceTimersByTime(20);
    expect(events.map((e) => e.path).sort()).toEqual(["a.ts", "b.ts"]);
  });

  it("stop() closes the OS watcher and cancels pending timers", () => {
    const fake = fakeWatch();
    const events: WatchEvent[] = [];
    const w = new FileWatcher({ watchFn: fake.watchFn, debounceMs: 50 });
    const stop = w.watch("/repo", (e) => events.push(e));
    fake.emit("change", "src/app.ts");
    stop();
    expect(fake.closed()).toBe(true);
    vi.advanceTimersByTime(100);
    expect(events).toEqual([]); // pending timer cancelled on stop
  });
});
