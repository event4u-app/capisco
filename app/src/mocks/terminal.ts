/**
 * Deterministic browser-mode {@link TerminalProvider} (road-to-actually-works P6).
 *
 * No PTY in the browser — this replays a fixed transcript as `data` events so
 * the xterm.js panel renders identical content offline (and pixel goldens stay
 * stable). The real shell lives in the sidecar PtyHost; this is the swap-point
 * fallback, same posture as {@link FakeRuntimeProvider}.
 *
 * Deterministic: no Date.now / Math.random / real timers — output is delivered
 * on microtasks (queueMicrotask) so tests await it without fake timers. The
 * transcript mirrors the prototype's static lines so the visual is unchanged.
 */

import type {
  TerminalEvent,
  TerminalInfo,
  TerminalOpenSpec,
  TerminalProvider,
  Unsubscribe,
} from "@/contracts";

/** The scripted transcript (mirrors the prototype `Terminal` lines). `\r\n` = a PTY newline. */
const TRANSCRIPT: string =
  "~/dev/capisco ❯ pnpm test core/broker\r\n" +
  "$ vitest run src/core/broker.test.ts\r\n" +
  "✓ broker · grants scoped capability once (4 ms)\r\n" +
  "✓ broker · denies revoked principal (2 ms)\r\n" +
  "✓ broker · escalates to prompt on unknown scope (6 ms)\r\n" +
  "Test Files  1 passed (1)\r\n" +
  "✓ 3 passed · 312ms\r\n" +
  "❯ ";

class MockTerminalProvider implements TerminalProvider {
  #pid = 4242;
  readonly #open = new Map<string, TerminalInfo>();
  readonly #listeners = new Map<string, Set<(event: TerminalEvent) => void>>();

  open(spec: TerminalOpenSpec): Promise<TerminalInfo> {
    const info: TerminalInfo = { id: spec.id, state: "running", pid: this.#pid++ };
    this.#open.set(spec.id, info);
    // Replay the transcript on a microtask so a subscriber (registered first)
    // observes it deterministically — same shape as a real PTY's first output.
    queueMicrotask(() => this.#emit({ id: spec.id, kind: "data", data: TRANSCRIPT }));
    return Promise.resolve(info);
  }

  write(id: string, data: string): Promise<void> {
    // Local echo so typing is visible offline (a real PTY echoes via the shell).
    queueMicrotask(() => this.#emit({ id, kind: "data", data }));
    return Promise.resolve();
  }

  resize(): Promise<void> {
    return Promise.resolve();
  }

  close(id: string): Promise<void> {
    this.#open.delete(id);
    return Promise.resolve();
  }

  list(): Promise<TerminalInfo[]> {
    return Promise.resolve([...this.#open.values()]);
  }

  subscribe(id: string, listener: (event: TerminalEvent) => void): Unsubscribe {
    let set = this.#listeners.get(id);
    if (!set) {
      set = new Set();
      this.#listeners.set(id, set);
    }
    set.add(listener);
    return () => {
      const s = this.#listeners.get(id);
      s?.delete(listener);
      if (s && s.size === 0) this.#listeners.delete(id);
    };
  }

  #emit(event: TerminalEvent): void {
    const set = this.#listeners.get(event.id);
    if (!set) return;
    for (const listener of set) listener(event);
  }
}

export const mockTerminalProvider: TerminalProvider = new MockTerminalProvider();
