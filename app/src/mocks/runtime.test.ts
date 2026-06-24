import { describe, expect, it } from "vitest";
import { FakeRuntimeProvider, StubPortAllocator } from "./runtime";
import type { RuntimeStatsFrame } from "@/contracts";

describe("FakeRuntimeProvider", () => {
  it("listServices returns deterministic groups (snapshot = first tick per container)", async () => {
    const p = new FakeRuntimeProvider();
    const groups = await p.listServices();
    expect(groups.map((g) => g.project)).toEqual(["capisco-core", "capisco-tauri"]);
    const core = groups.find((g) => g.project === "capisco-core")!;
    expect(core.services.map((s) => s.name)).toEqual([
      "web",
      "postgres",
      "traefik",
      "playwright",
    ]);
    // Snapshot is the FIRST tick — web at cpu 34, not the drifted 41.
    expect(core.services.find((s) => s.name === "web")?.cpu).toBe(34);
    // Two identical providers produce identical snapshots (deterministic).
    const groups2 = await new FakeRuntimeProvider().listServices();
    expect(groups2).toEqual(groups);
  });

  it("subscribeStats replays the full deterministic frame sequence", async () => {
    const p = new FakeRuntimeProvider();
    const frames: RuntimeStatsFrame[] = [];
    await new Promise<void>((done) => {
      p.subscribeStats((f) => {
        frames.push(f);
        // The last scripted frame is the tauri-build drift tick.
        if (f.name === "tauri-build" && f.cpu === 12) {
          // give microtask queue a beat to confirm no extra frames arrive
          queueMicrotask(() => done());
        }
      });
    });
    // 9 scripted frames total (6 initial + 3 drift).
    expect(frames).toHaveLength(9);
    // First frame is web@34, a later frame is web@41 (deterministic movement).
    expect(frames[0]).toMatchObject({ name: "web", cpu: 34 });
    expect(frames.some((f) => f.name === "web" && f.cpu === 41)).toBe(true);
  });

  it("unsubscribe stops further frames", async () => {
    const p = new FakeRuntimeProvider();
    const frames: RuntimeStatsFrame[] = [];
    const stop = p.subscribeStats((f) => {
      frames.push(f);
      stop(); // unsubscribe after the very first frame
    });
    await new Promise<void>((r) => queueMicrotask(() => queueMicrotask(r)));
    expect(frames).toHaveLength(1);
  });

  it("exposes a stub port allocator", () => {
    const p = new FakeRuntimeProvider();
    const alloc = p.ports();
    const a = alloc.allocate("sess-1");
    const b = alloc.allocate("sess-2");
    expect(b.port).toBe(a.port + 1);
    expect(alloc.reservations()).toHaveLength(2);
  });
});

describe("StubPortAllocator", () => {
  it("hands out ports in order from the range", () => {
    const alloc = new StubPortAllocator(5000, 5002);
    expect(alloc.allocate("x").port).toBe(5000);
    expect(alloc.allocate("y").port).toBe(5001);
    expect(alloc.allocate("z").port).toBe(5002);
  });

  it("reuses a released port", () => {
    const alloc = new StubPortAllocator(5000, 5001);
    const a = alloc.allocate("x");
    alloc.allocate("y");
    a.release();
    expect(alloc.reservations()).toHaveLength(1);
    // Next allocation wraps back to the freed 5000.
    expect(alloc.allocate("z").port).toBe(5000);
  });

  it("throws when the range is exhausted", () => {
    const alloc = new StubPortAllocator(5000, 5000);
    alloc.allocate("x");
    expect(() => alloc.allocate("y")).toThrow(/exhausted/);
  });

  it("release is idempotent", () => {
    const alloc = new StubPortAllocator(5000, 5001);
    const a = alloc.allocate("x");
    a.release();
    a.release();
    expect(alloc.reservations()).toHaveLength(0);
  });
});
