/**
 * Duplex byte transport abstraction (B0).
 *
 * The RPC peer (client or server side) needs only: send a string, receive
 * string chunks, observe close, and close. A unix socket, a TCP socket, or an
 * in-process pipe all satisfy this — so the peer logic (NdjsonDecoder + request
 * correlation + event dispatch) is written once against `Transport` and reused
 * by the real socket server, the browser/desktop client, and the deterministic
 * TS-IPC harness (Phase 1, no cargo / no Rust required).
 */

export type DataListener = (chunk: string) => void;
export type CloseListener = (err?: Error) => void;

/** A duplex, ordered, reliable byte channel carrying NDJSON lines. */
export interface Transport {
  /** Write a chunk. Resolves once the chunk is accepted by the channel. */
  send(chunk: string): void;
  /** Register a data listener. Returns an unregister handle. */
  onData(listener: DataListener): () => void;
  /** Register a close listener. Returns an unregister handle. */
  onClose(listener: CloseListener): () => void;
  /** Close the channel (idempotent). */
  close(): void;
  /** Whether the channel is still open. */
  readonly closed: boolean;
}

/**
 * A pair of in-process transports wired back-to-back. Writes on one surface as
 * `data` on the other. Used by the TS-IPC harness and the framing/backpressure
 * tests — no OS socket, fully deterministic, but exercises the exact same peer
 * code paths the real socket does.
 */
export function createPipePair(): { a: Transport; b: Transport } {
  const a = new InProcessTransport();
  const b = new InProcessTransport();
  a.peer = b;
  b.peer = a;
  return { a, b };
}

class InProcessTransport implements Transport {
  peer: InProcessTransport | null = null;
  private dataListeners = new Set<DataListener>();
  private closeListeners = new Set<CloseListener>();
  private isClosed = false;
  /** Optional async hop so back-to-back writes interleave like a real socket. */
  deliverAsync = false;

  get closed(): boolean {
    return this.isClosed;
  }

  send(chunk: string): void {
    if (this.isClosed) throw new Error("Transport is closed");
    const peer = this.peer;
    if (!peer || peer.isClosed) throw new Error("Peer transport is closed");
    const deliver = (): void => {
      for (const l of peer.dataListeners) l(chunk);
    };
    if (this.deliverAsync) queueMicrotask(deliver);
    else deliver();
  }

  onData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onClose(listener: CloseListener): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    for (const l of this.closeListeners) l();
    const peer = this.peer;
    if (peer && !peer.isClosed) peer.close();
  }
}
