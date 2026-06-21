/**
 * Node `net.Socket` ↔ {@link Transport} adapter (B0). Encodes outbound strings
 * as utf-8 and decodes inbound `Buffer`/`string` chunks back to utf-8 strings,
 * so the pure NDJSON/peer layers never touch bytes. Honours socket
 * backpressure: `send` respects `socket.write`'s return value only as a hint —
 * the NDJSON framing tolerates the OS coalescing/splitting writes regardless.
 */

import type { Socket } from "node:net";
import type { CloseListener, DataListener, Transport } from "@/lib/sidecar/protocol/transport.ts";

export class SocketTransport implements Transport {
  private isClosed = false;
  private readonly dataListeners = new Set<DataListener>();
  private readonly closeListeners = new Set<CloseListener>();
  private readonly socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string | Buffer) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      for (const l of this.dataListeners) l(text);
    });
    const onEnd = (err?: Error): void => this.fireClose(err);
    socket.on("close", () => onEnd());
    socket.on("end", () => onEnd());
    socket.on("error", (err) => onEnd(err));
  }

  get closed(): boolean {
    return this.isClosed;
  }

  send(chunk: string): void {
    if (this.isClosed) throw new Error("Socket transport is closed");
    this.socket.write(chunk, "utf8");
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
    this.socket.destroy();
    this.fireClose();
  }

  private fireClose(err?: Error): void {
    if (this.isClosed && this.closeListeners.size === 0) return;
    this.isClosed = true;
    for (const l of this.closeListeners) l(err);
    this.closeListeners.clear();
  }
}
