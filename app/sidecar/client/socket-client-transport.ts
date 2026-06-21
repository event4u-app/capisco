/**
 * Node `net.connect` ↔ {@link Transport} adapter for the client side (B0). Used
 * by the desktop shell + integration tests that drive a real unix socket. The
 * browser build never imports this (no `node:net`); the browser reaches the
 * sidecar through the desktop seam or falls back to the in-process mock client.
 */

import { connect, type Socket } from "node:net";
import type { CloseListener, DataListener, Transport } from "@/lib/sidecar/protocol/transport.ts";

export class SocketClientTransport implements Transport {
  private isClosed = false;
  private readonly dataListeners = new Set<DataListener>();
  private readonly closeListeners = new Set<CloseListener>();
  private readonly socket: Socket;

  private constructor(socket: Socket) {
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

  /** Connect to a sidecar unix socket; resolves once connected. */
  static connect(socketPath: string): Promise<SocketClientTransport> {
    return new Promise((resolve, reject) => {
      const socket = connect(socketPath);
      socket.once("error", reject);
      socket.once("connect", () => {
        socket.removeListener("error", reject);
        resolve(new SocketClientTransport(socket));
      });
    });
  }

  get closed(): boolean {
    return this.isClosed;
  }

  send(chunk: string): void {
    if (this.isClosed) throw new Error("Socket client transport is closed");
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
