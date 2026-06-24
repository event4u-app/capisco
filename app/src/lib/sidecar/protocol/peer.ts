/**
 * RPC peer logic (B0) — request correlation + event multiplexing over a
 * {@link Transport}. Two roles, one transport contract:
 *
 *  - {@link RpcServerPeer} reads requests, dispatches them to a `RequestHandler`,
 *    writes back one response each (result XOR error), and can push id-less
 *    event notifications on named channels.
 *  - {@link RpcClientPeer} writes requests with monotonic ids, correlates the
 *    matching responses back to the awaiting promise, and routes incoming event
 *    notifications to per-channel listeners (the session `subscribe` surface).
 *
 * Pure TS over the `Transport` seam — identical behaviour on a unix socket and
 * on the in-process pipe used by the harness + tests.
 */

import {
  EVENT_METHOD,
  JSONRPC_VERSION,
  RpcErrorCode,
  isErrorResponse,
  isNotification,
  isRequest,
  isResponse,
  type EventParams,
  type RpcId,
  type RpcRequest,
  type RpcResponse,
} from "./jsonrpc.ts";
import { NdjsonDecoder, encodeLine } from "./ndjson.ts";
import type { Transport } from "./transport.ts";

/** A method handler. Throws → the peer replies with a structured error. */
export type RequestHandler = (method: string, params: unknown) => Promise<unknown> | unknown;

/** Server side: dispatches requests, pushes events. */
export class RpcServerPeer {
  private readonly decoder = new NdjsonDecoder();
  private readonly transport: Transport;
  private readonly handler: RequestHandler;

  constructor(transport: Transport, handler: RequestHandler) {
    this.transport = transport;
    this.handler = handler;
    transport.onData((chunk) => this.ingest(chunk));
  }

  private ingest(chunk: string): void {
    let results;
    try {
      results = this.decoder.push(chunk);
    } catch (err) {
      // Runaway un-terminated line — drop the peer rather than buffer forever.
      this.transport.close();
      void err;
      return;
    }
    for (const r of results) {
      if (!r.ok) continue; // malformed line: ignore (no id to respond to).
      const msg = r.message;
      if (isRequest(msg)) void this.dispatch(msg);
    }
  }

  private async dispatch(req: RpcRequest): Promise<void> {
    try {
      const result = await this.handler(req.method, req.params);
      this.reply({ jsonrpc: JSONRPC_VERSION, id: req.id, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.reply({
        jsonrpc: JSONRPC_VERSION,
        id: req.id,
        error: { code: RpcErrorCode.ProviderError, message },
      });
    }
  }

  private reply(res: RpcResponse): void {
    if (this.transport.closed) return;
    this.transport.send(encodeLine(res));
  }

  /** Push an id-less event notification on a channel (the subscribe surface). */
  pushEvent(channel: string, event: unknown): void {
    if (this.transport.closed) return;
    const params: EventParams = { channel, event };
    this.transport.send(encodeLine({ jsonrpc: JSONRPC_VERSION, method: EVENT_METHOD, params }));
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

export type EventListener = (event: unknown) => void;

/** Client side: numbered requests + per-channel event listeners. */
export class RpcClientPeer {
  private readonly decoder = new NdjsonDecoder();
  private nextId = 1;
  private readonly pending = new Map<RpcId, Pending>();
  private readonly channels = new Map<string, Set<EventListener>>();
  private readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
    transport.onData((chunk) => this.ingest(chunk));
    transport.onClose((err) => this.failAll(err ?? new Error("Transport closed")));
  }

  private ingest(chunk: string): void {
    let results;
    try {
      results = this.decoder.push(chunk);
    } catch (err) {
      this.failAll(err instanceof Error ? err : new Error(String(err)));
      this.transport.close();
      return;
    }
    for (const r of results) {
      if (!r.ok) continue;
      const msg = r.message;
      if (isResponse(msg)) this.settle(msg);
      else if (isNotification(msg) && msg.method === EVENT_METHOD) {
        const params = msg.params as EventParams | undefined;
        if (params) this.dispatchEvent(params.channel, params.event);
      }
    }
  }

  private settle(res: RpcResponse): void {
    const p = this.pending.get(res.id);
    if (!p) return;
    this.pending.delete(res.id);
    if (isErrorResponse(res)) {
      const e = new Error(res.error.message);
      (e as Error & { code?: number }).code = res.error.code;
      p.reject(e);
    } else {
      p.resolve(res.result);
    }
  }

  private dispatchEvent(channel: string, event: unknown): void {
    const set = this.channels.get(channel);
    if (!set) return;
    for (const l of set) l(event);
  }

  private failAll(err: Error): void {
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
  }

  /** Send a request; resolves with the result or rejects with the RPC error. */
  request<R = unknown>(method: string, params?: unknown): Promise<R> {
    if (this.transport.closed) return Promise.reject(new Error("Transport is closed"));
    const id = this.nextId++;
    return new Promise<R>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      try {
        this.transport.send(encodeLine({ jsonrpc: JSONRPC_VERSION, id, method, params }));
      } catch (err) {
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Subscribe a listener to a channel's events. Returns an unsubscribe handle. */
  on(channel: string, listener: EventListener): () => void {
    let set = this.channels.get(channel);
    if (!set) {
      set = new Set();
      this.channels.set(channel, set);
    }
    set.add(listener);
    return () => {
      const s = this.channels.get(channel);
      if (!s) return;
      s.delete(listener);
      if (s.size === 0) this.channels.delete(channel);
    };
  }

  /** Pending (un-responded) request count — for tests/metrics. */
  get inFlight(): number {
    return this.pending.size;
  }
}
