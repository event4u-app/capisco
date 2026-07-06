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
  ExecutionGrant,
  GrantConfig,
  PolicyEngine,
  Principal,
  SecretStore,
  VaultWriteProposal,
} from "@/contracts";
import type { GrantAxis, PermissionDecision } from "@/contracts";
import type { WriteEscape } from "@/contracts";
import { isRtkFiltered } from "@/contracts";
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

/**
 * A stable fingerprint of the exact (principal × request) an execution grant is
 * bound to (C3). Two calls match iff every security-relevant field matches — so
 * a grant for `(agent, file-write src/a.ts)` can never authorize
 * `(agent, file-write src/b.ts)` or a request that flips `fromUntrusted`.
 */
function requestFingerprint(principal: Principal, request: CapabilityRequest): string {
  return JSON.stringify([
    principal.kind,
    principal.id,
    request.kind,
    request.target,
    request.command ?? "",
    request.credentialRef ?? "",
    Boolean(request.fromUntrusted),
    // scoped-grant v2.2 F2 — bind the grant to its issuing task, so a grant
    // minted under task A can never be executed by a request carrying task B.
    // Absent taskId → "" (existing non-task calls fingerprint identically).
    request.taskId ?? "",
  ]);
}

export class Broker implements CapabilityBroker {
  readonly #policy: PolicyEngine;
  readonly secrets: SecretStore;
  readonly audit: AuditStore;
  readonly #prodDatasources: ReadonlySet<string>;
  /**
   * C3 — single-use execution grants issued by `authorize`. Maps the opaque
   * grant id → the (principal × request) fingerprint it authorizes. `execute`
   * looks up the supplied grant here, verifies the fingerprint matches its own
   * request, and DELETES the entry (single-use). A grant id not in this map is
   * forged or already consumed — `execute` refuses it. The map is private; there
   * is no way to add an entry except through `authorize`.
   */
  readonly #grants = new Map<string, string>();
  /**
   * scoped-grant v2.2 step 5 — `taskId → set of outstanding grant ids`. Lets
   * {@link revokeTask} invalidate every unexecuted {@link ExecutionGrant} minted
   * under a task, closing the authorize→execute window (revoke between the two).
   */
  readonly #grantsByTask = new Map<string, Set<string>>();
  #grantSeq = 0;
  /**
   * S3 — used production-write escapes, by their opaque `id`. The first
   * successful prod write registers the escape id here; any later write riding
   * the SAME id (a reset clone or a freshly re-minted escape that the supplier
   * tries to replay) is refused. Consumption lives here, not on the (frozen)
   * escape's `consumed` flag.
   */
  readonly #usedEscapes = new Set<string>();

  constructor(opts: BrokerOptions = {}) {
    this.#policy =
      opts.policy ??
      new GrantPolicyEngine(opts.config ?? DEFAULT_GRANT_CONFIG, opts.projectKey);
    this.secrets = opts.secrets ?? new InMemorySecretStore();
    this.audit = opts.audit ?? new InMemoryAuditStore();
    this.#prodDatasources = opts.productionDatasources ?? new Set();
  }

  authorize(
    principal: Principal,
    request: CapabilityRequest,
    scope?: CapabilityScope,
  ): BrokerDecision {
    // RTK TRUST BOUNDARY (Phase 3, AK-T1/T2): RTK-filtered text is LLM-facing
    // ONLY — it must never become a fact the broker acts on. The TS brand
    // already bars it at compile time; this runtime guard is defense-in-depth.
    // A request whose target/command/credentialRef carries the RTK marker is
    // refused outright — the one-way data flow is structural, not conventional.
    if (
      isRtkFiltered(request.target) ||
      (request.command !== undefined && isRtkFiltered(request.command)) ||
      (request.credentialRef !== undefined && isRtkFiltered(request.credentialRef))
    ) {
      throw new Error(
        "broker refuses RTK-filtered (LLM-facing-only) input — it is an observation, " +
          "never an authoritative capability target (AK-T1/T2)",
      );
    }
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
    // C3 — only an `allow` decision mints a single-use execution grant bound to
    // THIS exact (principal × request). `execute` requires it; nothing else can
    // produce a valid grant id, so a forged "trusted" request cannot execute.
    if (decision.outcome === "allow") {
      const grant: ExecutionGrant = Object.freeze({ id: `grant-${++this.#grantSeq}` });
      this.#grants.set(grant.id, requestFingerprint(principal, request));
      // step 5 — index the grant by its issuing task so `revokeTask` can
      // invalidate it if the task is revoked before `execute` consumes it.
      if (request.taskId) {
        let ids = this.#grantsByTask.get(request.taskId);
        if (!ids) {
          ids = new Set();
          this.#grantsByTask.set(request.taskId, ids);
        }
        ids.add(grant.id);
      }
      return { ...decision, grant };
    }
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
    options: {
      scope?: CapabilityScope;
      writeEscape?: WriteEscape;
      grant?: ExecutionGrant;
    } = {},
  ): T {
    // 1. C3 — the chokepoint is now BOUND to a prior `authorize`. `execute` is
    //    NOT an independent re-decide: it requires the single-use execution
    //    grant that `authorize` minted for THIS exact (principal × request), and
    //    consumes it. A missing, forged, mismatched, or already-consumed grant
    //    is rejected. This closes the "call execute() with a hand-rolled
    //    `trusted` request" bypass — there is no grant for such a request.
    const grant = options.grant;
    const fingerprint = requestFingerprint(principal, request);
    if (!grant || this.#grants.get(grant.id) !== fingerprint) {
      throw new Error(
        `capability not authorized: ${request.kind}(${request.target}) — execution requires a matching, unconsumed authorize() grant`,
      );
    }
    // Consume the grant — single-use. A replay with the same handle now fails.
    this.#grants.delete(grant.id);
    // Keep the per-task index tidy (step 5) — drop the now-consumed grant id.
    if (request.taskId) this.#grantsByTask.get(request.taskId)?.delete(grant.id);

    // 2. Production datasource write invariant (§3.3 / S3). A write against a
    //    production datasource requires a command-matched single-shot escape —
    //    and consumption is tracked by the broker's used-escape registry (keyed
    //    on the escape's opaque, frozen `id`), NOT by a mutable `consumed` flag.
    //    So resetting `consumed` or re-minting a clone for the same prod write
    //    cannot replay it. There is no session-wide / "remember" escape shape,
    //    so a permanent prod-write is structurally unconstructable.
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
      if (this.#usedEscapes.has(escape.id)) {
        throw new Error("write escape already consumed — prod is read-only again");
      }
      // Consume in the broker registry — auto-revert to read-only after this one
      // write. The frozen escape's `consumed` flag is a back-compat mirror; the
      // registry is the authority a caller cannot reset.
      this.#usedEscapes.add(escape.id);
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

  revokeTask(taskId: string): void {
    // Drop the task's scoped grants in the policy engine…
    this.#policy.revokeTask(taskId);
    // …AND invalidate any outstanding (unexecuted) ExecutionGrants minted under
    // it, so a grant issued before the revoke can no longer execute (closes the
    // authorize→execute window — the v1 H3 revocation race).
    const ids = this.#grantsByTask.get(taskId);
    if (ids) {
      for (const id of ids) this.#grants.delete(id);
      this.#grantsByTask.delete(taskId);
    }
  }
}
