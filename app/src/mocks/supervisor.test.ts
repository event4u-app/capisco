/**
 * Mock process-supervisor (agent-matrix P0). Deterministic health snapshot;
 * subscribe replays the snapshot then unsubscribes cleanly. Lifecycle facts
 * only — no command / output / secret in the shape.
 */

import { describe, expect, it, vi } from "vitest";
import { createMockSupervisor, mockSupervisorProvider } from "./supervisor.ts";

describe("mockSupervisorProvider", () => {
  it("reports a deterministic health snapshot across process kinds", async () => {
    const h = await mockSupervisorProvider.health();
    const ids = h.map((p) => p.id);
    expect(ids).toContain("pty:term-1");
    expect(ids).toContain("lsp:ts:/repo");
    expect(ids).toContain("dap:php:9003");
    expect(ids).toContain("agent:s1");
  });

  it("marks restarts and exited/restarting states", async () => {
    const h = await mockSupervisorProvider.health();
    expect(h.find((p) => p.id === "lsp:php:/repo")).toMatchObject({
      state: "restarting",
      restarts: 2,
    });
    expect(h.find((p) => p.id === "dap:php:9003")?.state).toBe("exited");
    expect(h.find((p) => p.id === "agent:s1")?.restarts).toBe(1);
  });

  it("carries only lifecycle facts — no command / output / secret field", async () => {
    const [p] = await mockSupervisorProvider.health();
    expect(Object.keys(p).sort()).toEqual(["id", "pid", "restarts", "state"]);
    expect(JSON.stringify(await mockSupervisorProvider.health())).not.toMatch(
      /command|args|env|secret|sk-|ghp_/i,
    );
  });

  it("subscribe replays the snapshot on a microtask, then unsubscribes cleanly", async () => {
    const store = createMockSupervisor([
      { id: "pty:x", state: "running", pid: 1, restarts: 0 },
    ]);
    const seen = vi.fn();
    const unsub = store.subscribe(seen);
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(seen.mock.calls[0][0]).toHaveLength(1);
    unsub();
    // No further pushes after unsubscribe (the fake only replays once).
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
