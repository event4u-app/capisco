/**
 * BrokerProvider (B4) — the RPC-safe surface of the broker, registered on the
 * provider registry so the UI can reach the chokepoint over the IPC spine.
 *
 * SECURITY: only the non-secret-bearing surface is RPC-able:
 *  - `authorize` / `resolve` — the policy decision + grant return channel.
 *  - `listSecretRefs` — reference NAMES only (never values).
 *  - `listAudit` — the append-only log (credentialRef names, never values).
 *
 * `execute` and any secret VALUE path are deliberately NOT on the wire: a secret
 * value is injected only at the execution layer, in-process, never serialized to
 * a JSON-RPC frame (which would land it in a log / the session store). This
 * mirrors the B2 runtime split (streaming + allocator stay out-of-band). The
 * in-process consumer reaches the full {@link Broker} directly for execution.
 */

import type {
  AuditEntry,
  BrokerDecision,
  CapabilityRequest,
  CapabilityScope,
  GrantAxis,
  PermissionDecision,
  Principal,
} from "@/contracts";
import type { Broker } from "./capability-broker.ts";

export class BrokerProvider {
  readonly #broker: Broker;

  constructor(broker: Broker) {
    this.#broker = broker;
  }

  authorize(
    principal: Principal,
    request: CapabilityRequest,
    scope?: CapabilityScope,
  ): Promise<BrokerDecision> {
    return Promise.resolve(this.#broker.authorize(principal, request, scope));
  }

  resolve(
    principal: Principal,
    request: CapabilityRequest,
    decision: PermissionDecision,
    scope?: CapabilityScope,
  ): Promise<GrantAxis> {
    return Promise.resolve(this.#broker.resolve(principal, request, decision, scope));
  }

  /** Reference NAMES only — never values. Safe to serialize / log / display. */
  listSecretRefs(): Promise<string[]> {
    return Promise.resolve(this.#broker.secrets.list());
  }

  /** The append-only audit log (credentialRef names only, never values). */
  listAudit(): Promise<readonly AuditEntry[]> {
    return Promise.resolve(this.#broker.audit.list());
  }
}
