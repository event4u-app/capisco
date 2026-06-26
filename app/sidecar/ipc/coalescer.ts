/**
 * IPC stream coalescer (road-to-actually-works P1).
 *
 * Transport-agnostic throttle for high-frequency streams (PTY bytes, token
 * bursts, container `docker stats`). The council read-through flagged that WS
 * gets TCP backpressure for free but Tauri IPC events are fire-and-forget and
 * lag/drop under flood — so high-frequency frames must NEVER be 1:1-mapped to
 * IPC events. This batches them and flushes at most once per frame (~60fps).
 *
 * Two modes — the distinction is load-bearing:
 *  - `append`  : concatenate chunks, flush the whole batch. **Never loses bytes.**
 *                For PTY output and token deltas, where every byte matters.
 *  - `latest`  : keep only the newest value, drop the rest. **Drops by design.**
 *                For stats/metrics, where only the current frame matters.
 *
 * The timer is injectable (`schedule`/`cancel`) so the batching logic is tested
 * deterministically with fake timers, no wall-clock.
 */

export type CoalesceMode = "append" | "latest";

export interface CoalescerOptions<T> {
  readonly mode: CoalesceMode;
  /** Max flush cadence in ms. Default 16 (~60fps). */
  readonly frameMs?: number;
  /** Called with the coalesced payload: a concatenated string (`append`) or the latest value (`latest`). */
  readonly flush: (payload: T) => void;
  /** Injectable timer (tests pass fakes). Defaults to setTimeout/clearTimeout. */
  readonly schedule?: (fn: () => void, ms: number) => unknown;
  readonly cancel?: (handle: unknown) => void;
}

/**
 * `append`-mode coalescer for string streams (PTY, token deltas). Bytes are
 * never dropped — they are concatenated and flushed in the next frame.
 */
export class StringCoalescer {
  #pending = "";
  #has = false;
  #timer: unknown;
  readonly #frameMs: number;
  readonly #flush: (payload: string) => void;
  readonly #schedule: (fn: () => void, ms: number) => unknown;
  readonly #cancel: (handle: unknown) => void;

  constructor(opts: Omit<CoalescerOptions<string>, "mode">) {
    this.#frameMs = opts.frameMs ?? 16;
    this.#flush = opts.flush;
    this.#schedule = opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.#cancel = opts.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  push(chunk: string): void {
    this.#pending += chunk;
    this.#has = true;
    this.#arm();
  }

  #arm(): void {
    if (this.#timer !== undefined) return;
    this.#timer = this.#schedule(() => {
      this.#timer = undefined;
      this.flushNow();
    }, this.#frameMs);
  }

  /** Force an immediate flush (e.g. before close, so no bytes are stranded). */
  flushNow(): void {
    if (!this.#has) return;
    const payload = this.#pending;
    this.#pending = "";
    this.#has = false;
    this.#flush(payload);
  }

  dispose(): void {
    if (this.#timer !== undefined) {
      this.#cancel(this.#timer);
      this.#timer = undefined;
    }
    this.flushNow();
  }
}

/**
 * `latest`-mode coalescer for value streams (stats/metrics). Only the newest
 * value survives a frame — older values are dropped by design (drop-oldest).
 */
export class LatestCoalescer<T> {
  #latest: T | undefined;
  #has = false;
  #timer: unknown;
  readonly #frameMs: number;
  readonly #flush: (payload: T) => void;
  readonly #schedule: (fn: () => void, ms: number) => unknown;
  readonly #cancel: (handle: unknown) => void;

  constructor(opts: Omit<CoalescerOptions<T>, "mode">) {
    this.#frameMs = opts.frameMs ?? 16;
    this.#flush = opts.flush;
    this.#schedule = opts.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.#cancel = opts.cancel ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  }

  push(value: T): void {
    this.#latest = value;
    this.#has = true;
    if (this.#timer !== undefined) return;
    this.#timer = this.#schedule(() => {
      this.#timer = undefined;
      this.flushNow();
    }, this.#frameMs);
  }

  flushNow(): void {
    if (!this.#has) return;
    const payload = this.#latest as T;
    this.#latest = undefined;
    this.#has = false;
    this.#flush(payload);
  }

  dispose(): void {
    if (this.#timer !== undefined) {
      this.#cancel(this.#timer);
      this.#timer = undefined;
    }
    this.flushNow();
  }
}
