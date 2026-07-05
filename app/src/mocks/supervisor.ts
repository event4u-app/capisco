import type { ProcessHealth, SupervisorProvider, Unsubscribe } from "@/contracts";

/**
 * Deterministic process-supervisor mock (agent-matrix P0). Mirrors the sidecar
 * `ProcessSupervisor.health()` / `subscribe` seam with a scripted snapshot of
 * the process kinds the runtime supervises — PTY, LSP, DAP, agent — including
 * one with a restart (the "restart-events marked" case) and one exited. No
 * `Date.now` / `Math.random` / real timers; `subscribe` replays the snapshot on
 * a microtask so a fresh subscriber sees state, then stays open for live pushes.
 */
const SNAPSHOT: ProcessHealth[] = [
  { id: "pty:term-1", state: "running", pid: 4821, restarts: 0 },
  { id: "lsp:ts:/repo", state: "running", pid: 4822, restarts: 0 },
  { id: "lsp:php:/repo", state: "restarting", pid: undefined, restarts: 2 },
  { id: "dap:php:9003", state: "exited", pid: undefined, restarts: 0 },
  { id: "agent:s1", state: "running", pid: 4830, restarts: 1 },
];

class InMemoryMockSupervisor implements SupervisorProvider {
  readonly #snapshot: ProcessHealth[];
  readonly #listeners = new Set<(health: ProcessHealth[]) => void>();

  constructor(snapshot: ProcessHealth[]) {
    this.#snapshot = snapshot.map((p) => Object.freeze({ ...p }));
  }

  health(): Promise<ProcessHealth[]> {
    return Promise.resolve([...this.#snapshot]);
  }

  subscribe(listener: (health: ProcessHealth[]) => void): Unsubscribe {
    this.#listeners.add(listener);
    let live = true;
    // Replay the current snapshot on a microtask so a subscriber sees state
    // before any live push (mirrors the runtime/agent mocks).
    void Promise.resolve().then(() => {
      if (live) listener([...this.#snapshot]);
    });
    return () => {
      live = false;
      this.#listeners.delete(listener);
    };
  }
}

/** Deterministic supervisor provider for the browser/mock path. */
export const mockSupervisorProvider: SupervisorProvider = new InMemoryMockSupervisor(SNAPSHOT);

/** Factory for tests needing an isolated snapshot. */
export function createMockSupervisor(snapshot: ProcessHealth[] = []): SupervisorProvider {
  return new InMemoryMockSupervisor(snapshot);
}
