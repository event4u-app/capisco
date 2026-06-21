/**
 * Browser-side WebSocket ↔ {@link Transport} adapter (DEV-ONLY).
 *
 * A browser cannot speak the production unix-socket the sidecar binds, so the
 * dev runtime fronts the same sidecar IPC over a localhost WebSocket (see
 * `sidecar/dev-bridge/`). This adapter turns that socket into the duplex byte
 * {@link Transport} the RPC peer layer is written against — identical framing
 * (NDJSON lines) to the real unix socket, so the exact same peer code paths run.
 *
 * NOT FOR PRODUCTION. The production desktop path stays the Tauri unix-socket
 * bridge (deferred); this transport only exists so `pnpm dev` can reach the
 * real sidecar without cargo/Tauri. The dev bridge binds 127.0.0.1 only.
 *
 * Browser-safe by construction: uses only the platform `WebSocket` global —
 * never `node:net`. Inbound text frames are forwarded verbatim to data
 * listeners; the NDJSON decoder downstream tolerates any chunk boundaries.
 */

import type { CloseListener, DataListener, Transport } from "@/lib/sidecar/protocol/transport";

export class WsClientTransport implements Transport {
  private isClosed = false;
  private readonly dataListeners = new Set<DataListener>();
  private readonly closeListeners = new Set<CloseListener>();
  private readonly socket: WebSocket;
  /** Lines queued while the socket is still CONNECTING; flushed on open. */
  private readonly sendQueue: string[] = [];

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener("message", (ev: MessageEvent) => {
      const data = ev.data;
      const text = typeof data === "string" ? data : String(data);
      for (const l of this.dataListeners) l(text);
    });
    socket.addEventListener("close", () => this.fireClose());
    socket.addEventListener("error", () => this.fireClose(new Error("websocket error")));
    socket.addEventListener("open", () => {
      for (const line of this.sendQueue.splice(0)) socket.send(line);
    });
  }

  /** Open a WebSocket to the dev bridge; resolves once connected (or rejects). */
  static connect(url: string): Promise<WsClientTransport> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      const onError = (): void => {
        socket.removeEventListener("error", onError);
        reject(new Error(`failed to connect to dev sidecar bridge at ${url}`));
      };
      socket.addEventListener("error", onError);
      socket.addEventListener(
        "open",
        () => {
          socket.removeEventListener("error", onError);
          resolve(new WsClientTransport(socket));
        },
        { once: true },
      );
    });
  }

  get closed(): boolean {
    return this.isClosed;
  }

  send(chunk: string): void {
    if (this.isClosed) throw new Error("WebSocket client transport is closed");
    if (this.socket.readyState === WebSocket.CONNECTING) {
      this.sendQueue.push(chunk);
      return;
    }
    this.socket.send(chunk);
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
    try {
      this.socket.close();
    } catch {
      /* best effort */
    }
    this.fireClose();
  }

  private fireClose(err?: Error): void {
    if (this.isClosed && this.closeListeners.size === 0) return;
    this.isClosed = true;
    for (const l of this.closeListeners) l(err);
    this.closeListeners.clear();
  }
}
