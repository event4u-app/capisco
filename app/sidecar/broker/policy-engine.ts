/**
 * Policy engine (B4 Phase 0) — `(Principal × Capability × Scope) → decision`.
 *
 * Pure decision logic over (a) the conservative human-authored grant config and
 * (b) per-project persisted grants from the §3 return channel. It executes
 * nothing and never sees a secret value.
 *
 * Invariants encoded here (verified by tests):
 *  - The human is NOT a privileged bypass (§3.1): the same rules apply to a
 *    `human` and an `agent` principal. Trust differs only for the
 *    untrusted-egress rule below.
 *  - **Untrusted egress can never auto-allow** (§3.3 lethal trifecta): a
 *    shell/file-write/network/db-write/external-write capability marked
 *    `fromUntrusted` is forced to `ask` regardless of the allowlist (see
 *    {@link EGRESS_KINDS}) — and crucially, a persisted
 *    `session`/`scoped` grant CANNOT pre-clear it either. Untrusted output is
 *    data, never instructions; the human must gate the egress every time.
 *  - **No forever-grant** (§3.2 / §4): `resolve` records only the
 *    {@link GrantAxis} values, none of which is permanent. `once` is single-shot
 *    (not persisted).
 *  - **Fail-closed**: a capability with no matching allow rule defaults to
 *    `ask`, never `allow`.
 */

import type {
  AllowlistRule,
  BrokerDecision,
  CapabilityKind,
  CapabilityRequest,
  CapabilityScope,
  GrantConfig,
  PolicyEngine,
  Principal,
} from "@/contracts";
import type { GrantAxis, PermissionDecision, PermissionRequest } from "@/contracts";
import { sep } from "node:path";

/**
 * A persisted grant record (scoped-grant v2.2 F3) — a discriminated union so a
 * `deny`/`session` carries no scoped fields, and a `scoped` carries its bounds:
 * the issuing `taskId` (task-bound — never rides another task), the absolute
 * realpath-canonicalised `pathPrefix` (the CALLER canonicalises; the engine only
 * string-compares), and the remaining action budget (`maxActions`).
 */
type PersistedGrant =
  | { axis: "deny" }
  | { axis: "session" }
  | { axis: "scoped"; taskId: string; pathPrefix: string; remaining: number };

/**
 * Case-insensitive filesystems (macOS/APFS, Windows) fold case + Unicode; a
 * byte-compare would split a decision the FS treats as one path. Fold on those
 * platforms so the boundary check matches the FS's own equality. (v2.2 Path GAP-1.)
 */
const CASE_INSENSITIVE_FS = process.platform === "darwin" || process.platform === "win32";

function normPath(p: string): string {
  const n = p.normalize("NFC");
  return CASE_INSENSITIVE_FS ? n.toLowerCase() : n;
}

/**
 * Boundary-anchored containment: `target` is `prefix` itself or STRICTLY under it
 * (`/src/` never matches `/srcX`). Both must be absolute + already
 * realpath-canonicalised by the caller. An empty prefix matches nothing (a scoped
 * grant with an empty prefix is rejected at issuance; this is belt-and-suspenders).
 */
function isUnderPrefix(target: string, prefix: string): boolean {
  if (!prefix) return false;
  const t = normPath(target);
  const base = normPath(prefix);
  const withSep = normPath(prefix.endsWith(sep) ? prefix : prefix + sep);
  return t === base || t.startsWith(withSep);
}

/**
 * Capability kinds that perform egress / mutation — gated when untrusted.
 *
 * `shell` is included: it is unconditionally egress-capable (a shell line can
 * `curl`/`nc`/`git push`/`npx`, and even allowlisted read-only git commands have
 * command-execution vectors — `git difftool`, `git log --ext-diff`, `--output=`,
 * pager/alias config). Excluding it would let a `fromUntrusted` shell request
 * skip the lethal-trifecta hard gate below and be auto-allowed by a benign
 * allowlist rule (e.g. `git status* → allow`) — the exact laundering this gate
 * exists to stop. Found by the scoped-grant-ux design-gate council review
 * (see agents/design-gates/scoped-grant-ux.md § Council Pre-Review, HOLE-1).
 */
const EGRESS_KINDS: ReadonlySet<CapabilityKind> = new Set<CapabilityKind>([
  "shell",
  "file-write",
  "network",
  "db-write",
  "external-write",
]);

/** Glob-ish match: a trailing `*` matches any suffix; otherwise exact. */
function matches(pattern: string, target: string): boolean {
  if (pattern.endsWith("*")) {
    return target.startsWith(pattern.slice(0, -1));
  }
  return pattern === target;
}

function findRule(
  rules: AllowlistRule[],
  kind: CapabilityKind,
  target: string,
): AllowlistRule | undefined {
  // First matching rule of the right kind wins (config order is significance).
  return rules.find((r) => r.kind === kind && matches(r.pattern, target));
}

let requestSeq = 0;

function buildRequest(
  request: CapabilityRequest,
  scope: CapabilityScope | undefined,
): PermissionRequest {
  return {
    id: `req-${++requestSeq}`,
    command: `${request.kind}(${request.target})`,
    label: request.target,
    scopes: scope ? [scope] : [],
    credentialRef: request.credentialRef,
    fromUntrusted: request.fromUntrusted,
  };
}

export class GrantPolicyEngine implements PolicyEngine {
  /** `JSON.stringify([projectKey, kind, scope])` → persisted grant record. */
  readonly #grants = new Map<string, PersistedGrant>();
  /**
   * Consumable, single-use allow keys (§3.3 lethal trifecta). A human who
   * clears an `ask` that ORIGINATED from untrusted egress authorises exactly
   * ONE call — never a standing grant. We record the key here so `execute`'s
   * re-decide can allow that one call, and `decide` removes it on first allow
   * so it can never launder into a future (trusted or untrusted) egress.
   */
  readonly #consumableGrants = new Set<string>();
  readonly #config: GrantConfig;
  /** Per-project key so persisted grants do not leak across projects. */
  readonly #projectKey: string;

  constructor(config: GrantConfig, projectKey = "default") {
    this.#config = config;
    this.#projectKey = projectKey;
  }

  // Keys are built with `JSON.stringify` of a tuple (the same injective idiom as
  // `requestFingerprint` in capability-broker.ts) — NOT a raw `:`-join. A naive
  // `:`-join is ambiguous when a component itself contains `:` (a `network`
  // target `https://h:443/x`, a Windows path `C:\…`), so two logically distinct
  // requests could collide onto one key and cross-clear each other's grant.
  // Found by the scoped-grant-ux design-gate council review (trifecta lens, HOLE-4).
  private grantKey(kind: CapabilityKind, scope?: CapabilityScope): string {
    return JSON.stringify([this.#projectKey, kind, scope ?? ""]);
  }

  /**
   * S2 — the single-use untrusted-egress consumable is keyed by kind + the
   * concrete TARGET (and `command` when present), not by kind:scope alone.
   * Clearing untrusted egress to target A must NOT pre-clear a DIFFERENT
   * untrusted egress to target B: the human approved exactly one call, and the
   * grant is bound to its exact target so it can only ever clear that one.
   */
  private consumableKey(request: CapabilityRequest, scope?: CapabilityScope): string {
    return JSON.stringify([
      this.#projectKey,
      request.kind,
      scope ?? "",
      request.target,
      request.command ?? "",
    ]);
  }

  /**
   * Whether a persisted `scoped` grant clears THIS request (scoped-grant v2.2).
   * All must hold: the request is a `file-write` (only file-write is scoped-able —
   * defensive twin of the issuance-time reject); it carries the SAME `taskId` the
   * grant was issued under (task-bound — a second live task never rides it); the
   * budget is not exhausted; and the request's absolute, realpath-canonicalised
   * `canonicalTarget` (the caller supplies it — the engine never touches the fs)
   * lies under the grant's `pathPrefix`. Pure — no I/O, no mutation.
   */
  private scopeMatches(
    grant: Extract<PersistedGrant, { axis: "scoped" }>,
    request: CapabilityRequest,
  ): boolean {
    if (request.kind !== "file-write") return false;
    if (!request.taskId || request.taskId !== grant.taskId) return false;
    if (grant.remaining <= 0) return false;
    if (!request.canonicalTarget) return false;
    return isUnderPrefix(request.canonicalTarget, grant.pathPrefix);
  }

  decide(
    _principal: Principal,
    request: CapabilityRequest,
    scope?: CapabilityScope,
  ): BrokerDecision {
    const untrustedEgress = Boolean(request.fromUntrusted) && EGRESS_KINDS.has(request.kind);

    // §3.3 — untrusted egress is a HARD human gate. No allowlist entry and no
    // persisted grant can pre-clear it. It always becomes `ask`.
    if (untrustedEgress) {
      return {
        outcome: "ask",
        request: buildRequest(request, scope),
        reason:
          "untrusted-derived egress (lethal trifecta) — hard human-in-the-loop gate, never auto",
      };
    }

    // §3.3 / S2 — a single-use grant from a human-cleared untrusted egress. It
    // authorises THIS one call only (bound to kind+target+command), consumed on
    // read so it can never pre-clear a later trusted OR untrusted egress — and,
    // because it is target-bound, it can never clear a DIFFERENT target either.
    const consumableKey = this.consumableKey(request, scope);
    if (this.#consumableGrants.has(consumableKey)) {
      this.#consumableGrants.delete(consumableKey);
      return { outcome: "allow", reason: "single-use grant (untrusted egress, per-call only)" };
    }

    // A persisted deny is sticky; a persisted session grant clears blanket; a
    // persisted `scoped` grant clears ONLY when `scopeMatches` (task-bound,
    // canonical target under pathPrefix, budget left) — otherwise it falls
    // through to the allowlist/ask (a scoped grant NEVER blanket-clears). This
    // whole branch is reached only AFTER the untrusted-egress hard gate above,
    // so a scoped grant can never pre-clear untrusted egress (v2.2 ordering).
    const persisted = this.#grants.get(this.grantKey(request.kind, scope));
    if (persisted?.axis === "deny") {
      return { outcome: "deny", reason: "previously denied for this scope" };
    }
    if (persisted?.axis === "session") {
      return { outcome: "allow", reason: "granted (session) for this scope" };
    }
    if (persisted?.axis === "scoped" && this.scopeMatches(persisted, request)) {
      persisted.remaining -= 1; // consume one action of the mandatory maxActions budget
      return {
        outcome: "allow",
        reason: `granted (scoped, ${persisted.remaining} left) under ${persisted.pathPrefix}`,
      };
    }

    // Consult the conservative allowlist config.
    const rule = findRule(this.#config.rules, request.kind, request.target);
    if (rule?.verdict === "allow") {
      return { outcome: "allow", reason: `allowlist: ${rule.kind} ${rule.pattern}` };
    }
    if (rule?.verdict === "deny") {
      return { outcome: "deny", reason: `denylist: ${rule.kind} ${rule.pattern}` };
    }

    // Fail-closed: no allow rule → ask the human.
    return {
      outcome: "ask",
      request: buildRequest(request, scope),
      reason: rule
        ? `allowlist: ${rule.kind} ${rule.pattern} (ask)`
        : "no matching grant — ask",
    };
  }

  resolve(
    _principal: Principal,
    request: CapabilityRequest,
    decision: PermissionDecision,
    scope?: CapabilityScope,
  ): GrantAxis {
    const axis: GrantAxis = decision.axis;
    const boundScope = decision.axis === "scoped" ? (decision.scope ?? scope) : scope;

    // §3.3 lethal trifecta — untrusted egress is PER-CALL ONLY, never
    // persistable. When the resolved `ask` ORIGINATED from untrusted-derived
    // egress, the human's decision authorises THIS single call and nothing
    // more — regardless of which axis they picked. We refuse to write a
    // standing session/scoped grant (that would launder one human "session"
    // OK on an untrusted action into an auto-clearing grant for future
    // trusted egress of the same kind/scope). Instead we record a single-use
    // consumable grant that `decide` allows exactly once and then drops. A
    // `deny` still persists (sticky deny is safe).
    const untrustedEgress = Boolean(request.fromUntrusted) && EGRESS_KINDS.has(request.kind);
    if (untrustedEgress) {
      if (axis === "deny") {
        this.#grants.set(this.grantKey(request.kind, boundScope), { axis: "deny" });
        return "deny";
      }
      // Clamp every non-deny axis to a single-use grant — `once` semantics.
      // S2: bind the consumable to kind+target+command so it clears ONLY the
      // exact call the human approved, never a different target's egress.
      this.#consumableGrants.add(this.consumableKey(request, boundScope));
      return "once";
    }

    // `once` is single-shot — never persisted. Everything else persists per
    // project+scope as a discriminated record. There is no forever value.
    const key = this.grantKey(request.kind, boundScope);
    if (axis === "deny") {
      this.#grants.set(key, { axis: "deny" });
    } else if (axis === "session") {
      this.#grants.set(key, { axis: "session" });
    } else if (axis === "scoped") {
      // Issuance validation (scoped-grant v2.2 steps 5+7): only file-write is
      // scoped-able; a taskId is mandatory (task-bound); the pathPrefix must be a
      // NON-empty ABSOLUTE dir (no wildcard default) — the caller has already
      // realpath-canonicalised it (the engine stays I/O-free). maxActions bounds it.
      if (request.kind !== "file-write") {
        throw new Error("scoped grant is only available for file-write");
      }
      if (!request.taskId) {
        throw new Error("scoped grant requires an issuing taskId");
      }
      const sg = decision.scopedGrant;
      if (!sg || !sg.pathPrefix || !sg.pathPrefix.startsWith(sep)) {
        throw new Error(
          "scoped grant requires a non-empty absolute pathPrefix (no wildcard default)",
        );
      }
      if (!Number.isInteger(sg.maxActions) || sg.maxActions <= 0) {
        throw new Error("scoped grant requires a positive integer maxActions budget");
      }
      this.#grants.set(key, {
        axis: "scoped",
        taskId: request.taskId,
        pathPrefix: sg.pathPrefix,
        remaining: sg.maxActions,
      });
    }
    // `once` falls through — never persisted.
    return axis;
  }

  /**
   * Revoke every `scoped` grant issued under `taskId` (scoped-grant v2.2 step 5).
   * `session`/`deny` records are not task-bound and are left intact. Idempotent —
   * a task with no scoped grants is a no-op.
   */
  revokeTask(taskId: string): void {
    for (const [key, grant] of this.#grants) {
      if (grant.axis === "scoped" && grant.taskId === taskId) {
        this.#grants.delete(key);
      }
    }
  }
}
