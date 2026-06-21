/**
 * The IPC server connection handler (B0). Binds one {@link Transport} (one
 * accepted socket / one harness pipe) to the {@link ProviderRegistry} via an
 * {@link RpcServerPeer}, and implements the reserved streaming verbs out of band
 * of the plain method router:
 *
 *  - `<provider>.subscribe`   — params `[targetId]`. Starts forwarding the
 *    provider's `subscribe(targetId, listener)` events as event notifications on
 *    channel `<provider>:<targetId>`. Returns a subscription id.
 *  - `<provider>.unsubscribe` — params `[subscriptionId]`. Stops forwarding and
 *    runs the provider's unsubscribe handle.
 *
 * Everything else is a flat `registry.dispatch`. When the transport closes,
 * every live subscription for this connection is torn down (no leaked
 * listeners) — the reconnect test relies on this.
 */

import { RpcServerPeer } from "@/lib/sidecar/protocol/peer.ts";
import type { Transport } from "@/lib/sidecar/protocol/transport.ts";
import type { ProviderRegistry } from "../registry/registry.ts";

/** Any provider exposing a subscribe(targetId, listener) → unsubscribe surface. */
interface Streamable {
  subscribe(targetId: string, listener: (event: unknown) => void): () => void;
}

function isStreamable(p: unknown): p is Streamable {
  return typeof (p as Streamable | undefined)?.subscribe === "function";
}

const SUBSCRIBE = "subscribe";
const UNSUBSCRIBE = "unsubscribe";

export class IpcConnection {
  private readonly peer: RpcServerPeer;
  private readonly subs = new Map<string, () => void>();
  private nextSubId = 1;
  private readonly registry: ProviderRegistry;

  constructor(transport: Transport, registry: ProviderRegistry) {
    this.registry = registry;
    this.peer = new RpcServerPeer(transport, (method, params) =>
      this.handle(method, params),
    );
    transport.onClose(() => this.teardown());
  }

  private async handle(qualified: string, params: unknown): Promise<unknown> {
    const dot = qualified.indexOf(".");
    if (dot === -1) {
      throw new Error(`Malformed method "${qualified}" (expected "provider.method")`);
    }
    const providerId = qualified.slice(0, dot);
    const method = qualified.slice(dot + 1);
    const args = Array.isArray(params) ? params : params === undefined ? [] : [params];

    if (method === SUBSCRIBE) return this.subscribe(providerId, args);
    if (method === UNSUBSCRIBE) return this.unsubscribe(args);

    return this.registry.dispatch(qualified, args);
  }

  private subscribe(providerId: string, args: unknown[]): string {
    const provider = this.registry.get(providerId);
    if (!provider) throw new Error(`Unknown provider "${providerId}"`);
    if (!isStreamable(provider)) {
      throw new Error(`Provider "${providerId}" is not streamable`);
    }
    const targetId = String(args[0]);
    const channel = `${providerId}:${targetId}`;
    const subId = `sub-${this.nextSubId++}`;
    const off = provider.subscribe(targetId, (event) => {
      this.peer.pushEvent(channel, event);
    });
    this.subs.set(subId, off);
    return subId;
  }

  private unsubscribe(args: unknown[]): boolean {
    const subId = String(args[0]);
    const off = this.subs.get(subId);
    if (!off) return false;
    off();
    this.subs.delete(subId);
    return true;
  }

  private teardown(): void {
    for (const [, off] of this.subs) {
      try {
        off();
      } catch {
        /* listener already gone */
      }
    }
    this.subs.clear();
  }

  /** Live subscription count for this connection — for tests/metrics. */
  get subscriptionCount(): number {
    return this.subs.size;
  }
}
