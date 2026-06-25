import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LatestCoalescer, StringCoalescer } from "../ipc/coalescer.ts";

describe("StringCoalescer (append mode — never loses bytes)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("batches many pushes into one flush per frame, concatenated in order", () => {
    const flushed: string[] = [];
    const c = new StringCoalescer({ frameMs: 16, flush: (p) => flushed.push(p) });
    c.push("a");
    c.push("b");
    c.push("c");
    expect(flushed).toEqual([]); // nothing flushed synchronously
    vi.advanceTimersByTime(16);
    expect(flushed).toEqual(["abc"]); // one coalesced frame, order preserved
  });

  it("never drops bytes across multiple frames", () => {
    const flushed: string[] = [];
    const c = new StringCoalescer({ frameMs: 16, flush: (p) => flushed.push(p) });
    c.push("frame1");
    vi.advanceTimersByTime(16);
    c.push("frame2");
    vi.advanceTimersByTime(16);
    expect(flushed.join("")).toBe("frame1frame2");
  });

  it("flushNow / dispose strands no bytes", () => {
    const flushed: string[] = [];
    const c = new StringCoalescer({ frameMs: 1000, flush: (p) => flushed.push(p) });
    c.push("tail");
    c.dispose(); // before the 1000ms frame fires
    expect(flushed).toEqual(["tail"]);
  });

  it("idle coalescer does not flush empty payloads", () => {
    const flushed: string[] = [];
    const c = new StringCoalescer({ frameMs: 16, flush: (p) => flushed.push(p) });
    c.flushNow();
    vi.advanceTimersByTime(100);
    expect(flushed).toEqual([]);
  });
});

describe("LatestCoalescer (latest mode — drops by design)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps only the newest value per frame (drop-oldest)", () => {
    const flushed: Array<{ cpu: number }> = [];
    const c = new LatestCoalescer<{ cpu: number }>({ frameMs: 16, flush: (p) => flushed.push(p) });
    c.push({ cpu: 1 });
    c.push({ cpu: 2 });
    c.push({ cpu: 3 });
    vi.advanceTimersByTime(16);
    expect(flushed).toEqual([{ cpu: 3 }]); // only the latest stats frame survives
  });

  it("emits one value per frame across frames", () => {
    const flushed: number[] = [];
    const c = new LatestCoalescer<number>({ frameMs: 16, flush: (p) => flushed.push(p) });
    c.push(1);
    vi.advanceTimersByTime(16);
    c.push(2);
    c.push(3);
    vi.advanceTimersByTime(16);
    expect(flushed).toEqual([1, 3]);
  });
});
