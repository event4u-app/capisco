import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReconnectingSidecarClient, type ConnectionState } from "./reconnecting-client.ts";
import type { Transport } from "../protocol/transport.ts";

/**
 * road-to-real-runtime P4 — reconnect lifecycle, deterministic with fake
 * transports + fake timers (no socket). Verifies death detection, backoff
 * reconnect, onReconnect (the UI's "re-read the session tree" hook), and that
 * an intentional close never reconnects.
 */
class FakeTransport implements Transport {
  closed = false;
  #closeCbs = new Set<() => void>();
  send(): void {}
  onData(): () => void {
    return () => {};
  }
  onClose(cb: () => void): () => void {
    this.#closeCbs.add(cb);
    return () => this.#closeCbs.delete(cb);
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const cb of this.#closeCbs) cb();
  }
  /** Simulate the sidecar dying under us. */
  die(): void {
    this.close();
  }
}

describe("ReconnectingSidecarClient", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("connects, detects death, reconnects with backoff, fires onReconnect", async () => {
    const transports: FakeTransport[] = [];
    const factory = () => {
      const t = new FakeTransport();
      transports.push(t);
      return t;
    };
    const states: ConnectionState[] = [];
    let reconnects = 0;
    const rc = new ReconnectingSidecarClient({ factory, baseDelayMs: 100, maxDelayMs: 1000 });
    rc.onStateChange((s) => states.push(s));
    rc.onReconnect(() => reconnects++);

    await rc.start();
    expect(rc.state).toBe("connected");
    expect(rc.client).toBeDefined();
    const first = rc.client;

    // Sidecar dies → reconnecting → after backoff → connected again (new client).
    transports[0].die();
    expect(rc.state).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(100);
    expect(rc.state).toBe("connected");
    expect(reconnects).toBe(1);
    expect(rc.client).toBeDefined();
    expect(rc.client).not.toBe(first); // a fresh client over the new transport
    expect(transports).toHaveLength(2);
    expect(states).toEqual(["connected", "reconnecting", "connected"]);
  });

  it("backs off exponentially across repeated failures, then succeeds", async () => {
    let failUntil = 2; // first 2 reconnect attempts throw
    const made: FakeTransport[] = [];
    const factory = () => {
      if (made.length > 0 && failUntil-- > 0) throw new Error("connect refused");
      const t = new FakeTransport();
      made.push(t);
      return t;
    };
    const rc = new ReconnectingSidecarClient({ factory, baseDelayMs: 100, maxDelayMs: 1000 });
    await rc.start();
    made[0].die();
    expect(rc.state).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(100); // attempt 1 → throws
    await vi.advanceTimersByTimeAsync(200); // attempt 2 (backoff doubled) → throws
    await vi.advanceTimersByTimeAsync(400); // attempt 3 → succeeds
    expect(rc.state).toBe("connected");
    expect(made).toHaveLength(2);
  });

  it("gives up after maxAttempts → closed", async () => {
    const factory = () => {
      if (calls++ === 0) return new FakeTransport(); // initial connect ok
      throw new Error("refused");
    };
    let calls = 0;
    const rc = new ReconnectingSidecarClient({ factory, baseDelayMs: 100, maxAttempts: 2 });
    await rc.start();
    // Trigger death by closing the only transport via the client.
    rc.client!.close();
    expect(rc.state).toBe("reconnecting");
    await vi.advanceTimersByTimeAsync(100); // attempt 1 fails → reschedule
    await vi.advanceTimersByTimeAsync(200); // attempt 2 fails → maxAttempts → closed
    expect(rc.state).toBe("closed");
  });

  it("an intentional close never reconnects", async () => {
    const transports: FakeTransport[] = [];
    const rc = new ReconnectingSidecarClient({
      factory: () => {
        const t = new FakeTransport();
        transports.push(t);
        return t;
      },
      baseDelayMs: 100,
    });
    await rc.start();
    rc.close();
    expect(rc.state).toBe("closed");
    await vi.advanceTimersByTimeAsync(5000);
    expect(transports).toHaveLength(1); // no reconnect attempt
  });
});
