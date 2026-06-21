/**
 * The headless sidecar (B0). A unix-socket JSON-RPC/NDJSON server that fronts a
 * {@link ProviderRegistry}. This is the home of the backend logic + providers
 * (concept §6 — ~90 % TypeScript, I/O coordination). The Rust/Tauri shell is a
 * thin deferred stub that would spawn this process and point the webview at the
 * Vite app; here it is exercised headlessly via integration tests + the TS-IPC
 * harness, so CI never depends on a `cargo` build.
 *
 * Lifecycle: `listen()` binds the socket (cleaning a stale path first),
 * `address()` returns the bound path, `close()` tears the server down and
 * disconnects clients. Each accepted connection is an {@link IpcConnection}.
 */

import { createServer, type Server, type Socket } from "node:net";
import { existsSync, unlinkSync } from "node:fs";
import { ProviderRegistry } from "../registry/registry.ts";
import { IpcConnection } from "./ipc-server.ts";
import { SocketTransport } from "./socket-transport.ts";

export interface SidecarOptions {
  /** Unix domain socket path to bind. */
  socketPath: string;
}

export class Sidecar {
  readonly registry = new ProviderRegistry();
  private server: Server | null = null;
  private readonly connections = new Set<IpcConnection>();
  private readonly options: SidecarOptions;

  constructor(options: SidecarOptions) {
    this.options = options;
  }

  /** Bind the unix socket and start accepting connections. */
  listen(): Promise<void> {
    if (this.server) throw new Error("Sidecar is already listening");
    // A stale socket file from an unclean shutdown blocks bind — remove it.
    if (existsSync(this.options.socketPath)) {
      try {
        unlinkSync(this.options.socketPath);
      } catch {
        /* best effort */
      }
    }
    const server = createServer((socket: Socket) => this.accept(socket));
    this.server = server;
    return new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.options.socketPath, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
  }

  private accept(socket: Socket): void {
    const transport = new SocketTransport(socket);
    const conn = new IpcConnection(transport, this.registry);
    this.connections.add(conn);
    transport.onClose(() => this.connections.delete(conn));
  }

  /** The bound socket path (after `listen`). */
  address(): string {
    return this.options.socketPath;
  }

  /** Live connection count — for tests/metrics. */
  get connectionCount(): number {
    return this.connections.size;
  }

  /** Stop accepting, disconnect clients, remove the socket file. */
  close(): Promise<void> {
    const server = this.server;
    if (!server) return Promise.resolve();
    this.server = null;
    return new Promise<void>((resolve) => {
      server.close(() => {
        if (existsSync(this.options.socketPath)) {
          try {
            unlinkSync(this.options.socketPath);
          } catch {
            /* best effort */
          }
        }
        resolve();
      });
      // Force-disconnect any lingering clients so close() actually settles.
      server.unref();
    });
  }
}
