/**
 * CapabilityBroker (B4) — the un-bypassable execution chokepoint (§3 / overview
 * §3). Every capability an agent or human performs flows through `authorize`
 * then `execute`. No provider exposes an execution edge around it.
 *
 * It composes the three subsystems:
 *  - {@link GrantPolicyEngine} — `(Principal × Capability × Scope) → decision`.
 *  - {@link InMemorySecretStore} — capability-by-reference vault.
 *  - {@link InMemoryAuditStore} — append-only audit, written BEFORE execution.
 *
 * Hard invariants encoded here and verified by tests:
 *  1. `execute` refuses any capability not first authorized to `allow`
 *     (chokepoint — no bypass).
 *  2. Secrets are injected ONLY at the execution layer through the
 *     {@link ExecutionContext.withSecret} callback — the value never returns to
 *     the caller, never lands in env / CLI-arg / prompt / audit.
 *  3. A production datasource write requires a fresh, unconsumed single-shot
 *     {@link WriteEscape} for the exact command — and the escape is consumed
 *     (auto-revert). A `session`-wide or "remember" prod-write is
 *     unconstructable: no such escape shape exists.
 *  4. Untrusted-derived egress is forced through `authorize`'s hard gate (the
 *     policy engine) and can never auto-fire.
 *  5. The append-only audit entry is written BEFORE the `run` callback executes.
 */

import type {
  AuditStore,
  BrokerDecision,
  CapabilityBroker,
  CapabilityRequest,
  CapabilityScope,
  ExecutionContext,
  GrantConfig,
  PolicyEngine,
  Principal,
  SecretStore,
  VaultWriteProposal,
} from "@/contracts";
import type { GrantAxis, PermissionDecision } from "@/contracts";
import type { WriteEscape } from "@/contracts";
import { GrantPolicyEngine } from "./policy-engine.ts";
import { InMemorySecretStore } from "./in-memory-secret-store.ts";
import { InMemoryAuditStore } from "./audit-store.ts";
import { DEFAULT_GRANT_CONFIG } from "./default-grants.ts";

export interface BrokerOptions {
  /** Conservative grant config (defaults to the human-authored allowlist). */
  config?: GrantConfig;
  policy?: PolicyEngine;
  secrets?: SecretStore;
  audit?: AuditStore;
  projectKey?: string;
  /**
   * Set of datasource names that are PRODUCTION (read-only invariant §3.3).
   * This is HUMAN-CONFIRMED config — never inferred from a connection string.
   * A db-write whose target is in this set requires a single-shot WriteEscape.
   */
  productionDatasources?: ReadonlySet<string>;
}

export class Broker implements CapabilityBroker {
  readonly #policy: PolicyEngine;
  readonly secrets: SecretStore;
  readonly audit: AuditStore;
  readonly #prodDatasources: ReadonlySet<string>;

  constructor(opts: BrokerOptions = {}) {
    this.#policy = opts.policy ?? new GrantPolicyEngine(opts.config ?? DEFAULT_GRANT_CONFIG, opts.projectKey);
    this.secrets = opts.secrets ?? new InMemorySecretStore();
    this.audit = opts.audit ?? new InMemoryAuditStore();
    this.#prodDatasources = opts.productionDatasources ?? new Set();
  }

  authorize(
    principal: Principal,
    request: CapabilityRequest,
    scope?: CapabilityScope,
  ): BrokerDecision {
    const decision = this.#policy.decide(principal, request, scope);
    // Append-only audit of the authorization decision (BEFORE any execution).
    this.audit.record({
      principalId: principal.id,
      principalKind: principal.kind,
      capability: request.kind,
      target: request.target,
      credentialRef: request.credentialRef,
      outcome: decision.outcome,
      fromUntrusted: Boolean(request.fromUntrusted),
      reason: decision.reason,
    });
    return decision;
  }

  resolve(
    principal: Principal,
    request: CapabilityRequest,
    decision: PermissionDecision,
    scope?: CapabilityScope,
  ): GrantAxis {
    return this.#policy.resolve(principal, request, decision, scope);
  }

  execute<T>(
    principal: Principal,
    request: CapabilityRequest,
    run: (ctx: ExecutionContext) => T,
    options: { scope?: CapabilityScope; writeEscape?: WriteEscape } = {},
  ): T {
    // 1. Re-authorize at execution time — the chokepoint. No execution edge
    //    exists that did not pass this. Anything other than `allow` throws.
    const decision = this.#policy.decide(principal, request, options.scope);
    if (decision.outcome !== "allow") {
      throw new Error(
        `capability not authorized (${decision.outcome}): ${request.kind}(${request.target}) — ${decision.reason}`,
      );
    }

    // 2. Production datasource write invariant (§3.3). A write against a
    //    production datasource requires a fresh, unconsumed, command-matched
    //    single-shot escape — which we consume (auto-revert). There is no
    //    session-wide / "remember" escape shape, so a permanent prod-write is
    //    structurally unconstructable.
    if (request.kind === "db-write" && this.#prodDatasources.has(request.target)) {
      const escape = options.writeEscape;
      if (!escape) {
        throw new Error(
          `production datasource "${request.target}" is read-only — a single-shot write escape is required`,
        );
      }
      if (escape.datasource !== request.target) {
        throw new Error("write escape is for a different datasource");
      }
      // The escape authorises ONE exact statement — match it against the
      // request's command. A mismatched / missing command cannot ride the escape.
      if (!request.command || escape.command !== request.command) {
        throw new Error("write escape does not match this command");
      }
      if (escape.consumed) {
        throw new Error("write escape already consumed — prod is read-only again");
      }
      // Consume — auto-revert to read-only after this one write.
      escape.consumed = true;
    }

    // 3. Append-only audit of the EXECUTION, written BEFORE the callback runs.
    this.audit.record({
      principalId: principal.id,
      principalKind: principal.kind,
      capability: request.kind,
      target: request.target,
      credentialRef: request.credentialRef,
      outcome: "executed",
      fromUntrusted: Boolean(request.fromUntrusted),
      reason: "authorized execution",
    });

    // 4. Run with an execution context whose ONLY secret path is the injector.
    const ctx: ExecutionContext = {
      withSecret: <R>(ref: string, use: (value: string) => R): R =>
        this.secrets.inject(ref, use),
    };
    return run(ctx);
  }
  proposeVaultWrite(ref: string, reason: string): VaultWriteProposal {
    this.audit.record({
      principalId: "broker",
      principalKind: "agent",
      capability: "secret-read",
      target: ref,
      credentialRef: ref,
      outcome: "vault-write-proposed",
      fromUntrusted: false,
      reason,
    });
    // Proposed, NOT approved, NOT written into chat. The value is supplied only
    // on explicit approval via commitVaultWrite.
    return { ref, reason, approved: false };
  }

  commitVaultWrite(proposal: VaultWriteProposal, value: string): void {
    if (!proposal.approved) {
      throw new Error("vault write-back requires explicit human approval");
    }
    // The value goes straight into the vault, never the chat / log.
    this.secrets.put(proposal.ref, value);
  }
}
