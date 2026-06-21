/**
 * Transport-agnostic sidecar client (B0). Wraps an {@link RpcClientPeer} to
 * provide the two primitives every provider proxy needs:
 *
 *  - `call(provider, method, args)` — one request → one response.
 *  - `subscribe(provider, targetId, listener)` — opens a server-side stream,
 *    routes its event notifications (channel `<provider>:<targetId>`) to the
 *    listener, and returns an unsubscribe handle that also tells the server to
 *    stop forwarding.
 *
 * The transport is injected: a unix socket in the desktop shell, an in-process
 * pipe in the harness/tests. Identical behaviour either way.
 */

import { RpcClientPeer } from "../protocol/peer.ts";
import type { Transport } from "../protocol/transport.ts";

export class SidecarClient {
  private readonly peer: RpcClientPeer;
  private readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
    this.peer = new RpcClientPeer(transport);
  }

  /** One provider-method call. */
  call<R = unknown>(provider: string, method: string, args: unknown[] = []): Promise<R> {
    return this.peer.request<R>(`${provider}.${method}`, args);
  }

  /**
   * Open a streaming subscription. Registers the channel listener *before* the
   * server-side `subscribe` request resolves, so no early event is missed, then
   * returns an unsubscribe handle.
   */
  async subscribe(
    provider: string,
    targetId: string,
    listener: (event: unknown) => void,
  ): Promise<() => void> {
    const channel = `${provider}:${targetId}`;
    const off = this.peer.on(channel, listener);
    let subId: string;
    try {
      subId = await this.peer.request<string>(`${provider}.subscribe`, [targetId]);
    } catch (err) {
      off();
      throw err;
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      off();
      // Best-effort server-side teardown; ignore if the socket already closed.
      void this.peer.request(`${provider}.unsubscribe`, [subId]).catch(() => {});
    };
  }

  get inFlight(): number {
    return this.peer.inFlight;
  }

  close(): void {
    this.transport.close();
  }
}
