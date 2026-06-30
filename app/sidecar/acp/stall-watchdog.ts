/**
 * Stall watchdog for a long-lived agent run (road-to-real-runtime P4).
 *
 * "What if `claude` hangs mid-run?" — a run that emits no event for too long is
 * treated as hung: the watchdog fires once, the caller aborts the transport
 * cleanly and publishes a recoverable `error` status (the user resumes via
 * retry-as-branch on the session tree). Each real event {@link kick}s the timer;
 * a clean finish {@link stop}s it. Pure (only `setTimeout`), so it is unit-tested
 * deterministically with fake timers — no real agent process needed.
 */
export class StallWatchdog {
  #timer: ReturnType<typeof setTimeout> | undefined;
  #fired = false;
  readonly #ms: number;
  readonly #onStall: () => void;

  constructor(timeoutMs: number, onStall: () => void) {
    this.#ms = timeoutMs;
    this.#onStall = onStall;
  }

  /** Arm the watchdog (call when the run starts). */
  start(): void {
    this.#arm();
  }

  /** Reset the timer — activity means the run is alive. No-op once fired. */
  kick(): void {
    if (!this.#fired) this.#arm();
  }

  /** Cancel the watchdog (clean finish / teardown). Idempotent. */
  stop(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  /** True once the stall handler has fired. */
  get fired(): boolean {
    return this.#fired;
  }

  #arm(): void {
    this.stop();
    if (this.#ms <= 0) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#fired = true;
      this.#onStall();
    }, this.#ms);
  }
}
