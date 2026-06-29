/**
 * Reconnecting sidecar client (road-to-real-runtime P4) — "the sidecar dies
 * mid-run; the app notices, reconnects, and restores the session tree."
 *
 * A {@link SidecarClient} wraps ONE transport and cannot re-establish itself, so
 * this wraps the connection LIFECYCLE: given a transport factory, it builds a
 * client, watches the transport for an unexpected close, and on death transitions
 * to `reconnecting`, re-opens with capped exponential backoff, and on success
 * fires `onReconnect` so the UI re-reads the (persistent) session tree. An
 * intentional {@link close} never reconnects.
 *
 * Transport-agnostic + side-effect-free beyond the injected factory, so it is
 * unit-tested deterministically with fake transports + fake timers — no socket.
 */

import { SidecarClient } from "./sidecar-client.ts";
import type { Transport } from "../protocol/transport.ts";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "closed";

export interface ReconnectOptions {
  /** Produce a fresh, connected transport. Throwing/rejecting triggers backoff retry. */
  factory: () => Transport | Promise<Transport>;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Give up after this many consecutive failed reconnects (then `closed`). 0 = forever. */
  maxAttempts?: number;
}

export class ReconnectingSidecarClient {
  readonly #factory: () => Transport | Promise<Transport>;
  readonly #base: number;
  readonly #max: number;
  readonly #maxAttempts: number;
  #client: SidecarClient | undefined;
  #transport: Transport | undefined;
  #offClose: (() => void) | undefined;
  #state: ConnectionState = "connecting";
  #attempts = 0;
  #closed = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  readonly #stateCbs = new Set<(s: ConnectionState) => void>();
  readonly #reconnectCbs = new Set<() => void>();

  constructor(opts: ReconnectOptions) {
    this.#factory = opts.factory;
    this.#base = opts.baseDelayMs ?? 200;
    this.#max = opts.maxDelayMs ?? 5_000;
    this.#maxAttempts = opts.maxAttempts ?? 0;
  }

  /** Open the first connection. Resolves once connected (or rejects if the very
   *  first open fails — initial connect is the caller's to handle). */
  async start(): Promise<void> {
    await this.#open(false);
  }

  get state(): ConnectionState {
    return this.#state;
  }

  /** The current client. Undefined while (re)connecting. */
  get client(): SidecarClient | undefined {
    return this.#client;
  }

  onStateChange(cb: (s: ConnectionState) => void): () => void {
    this.#stateCbs.add(cb);
    return () => this.#stateCbs.delete(cb);
  }

  /** Fires after a successful RECONNECT (not the initial connect) — re-read here. */
  onReconnect(cb: () => void): () => void {
    this.#reconnectCbs.add(cb);
    return () => this.#reconnectCbs.delete(cb);
  }

  close(): void {
    this.#closed = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#offClose?.();
    this.#transport?.close();
    this.#client = undefined;
    this.#setState("closed");
  }

  #setState(s: ConnectionState): void {
    if (this.#state === s) return;
    this.#state = s;
    for (const cb of this.#stateCbs) cb(s);
  }

  async #open(isReconnect: boolean): Promise<void> {
    const transport = await this.#factory();
    if (this.#closed) {
      transport.close();
      return;
    }
    this.#transport = transport;
    this.#client = new SidecarClient(transport);
    this.#offClose = transport.onClose(() => this.#onClose());
    this.#attempts = 0;
    this.#setState("connected");
    if (isReconnect) for (const cb of this.#reconnectCbs) cb();
  }

  #onClose(): void {
    if (this.#closed) return; // intentional close — no reconnect
    this.#client = undefined;
    this.#setState("reconnecting");
    this.#scheduleReconnect();
  }

  #scheduleReconnect(): void {
    if (this.#closed) return;
    if (this.#maxAttempts > 0 && this.#attempts >= this.#maxAttempts) {
      this.#setState("closed");
      return;
    }
    const delay = Math.min(this.#max, this.#base * 2 ** this.#attempts);
    this.#attempts += 1;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      if (this.#closed) return;
      void this.#open(true).catch(() => this.#scheduleReconnect());
    }, delay);
  }
}
