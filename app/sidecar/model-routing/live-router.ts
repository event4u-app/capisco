/**
 * LiveModelRouter (road-to-model-routing P0/P1) — the LIVE composition of the
 * pure origin-router (`src/lib/model-routing/router.ts`) into the session/
 * subagent spawn path. The pure functions are exhaustively unit-tested and
 * deterministic; THIS class adds the two stateful concerns the spawn path needs
 * and nothing more:
 *
 *  1. The ON/OFF TOGGLE (DEFAULT OFF). Routing intervenes non-deterministically
 *     in the *result*, so it must be opt-in and calibrated on real runs before
 *     it silently swaps models. When OFF, a spawned session keeps the DEFAULT
 *     (large) tier — routing only ever shrinks from large, never the reverse, so
 *     "off" === "always the strongest model" === the conservative posture.
 *
 *  2. The BLOCKLIST as a RUNTIME INVARIANT, not merely a pure predicate. Broker-
 *     path (permission) decisions, the AI-review session itself, and any
 *     untrusted-egress surface are NEVER downgraded — INDEPENDENT of the toggle.
 *     `resolveSpawn` enforces this structurally: a blocklisted origin returns the
 *     large tier whether routing is on or off. A weaker model making a
 *     judgement/safety call is a security downgrade; the toggle cannot reach it.
 *     Extending the blocklist is a security decision — there is deliberately NO
 *     setter for the blocklist on this class.
 *
 * The tier → concrete {@link ModelId} binding is config ({@link ModelTierMap}),
 * so the same routing logic drives whatever the deployment's small/mid/large
 * models are. No content inspection, no LLM call here — the input is the
 * orchestrator-known {@link SessionOrigin}.
 */

import {
  DEFAULT_TIER,
  escalateOnQuality,
  isBlocklisted,
  resolveModel,
  routeOrigin,
} from "@/lib/model-routing/router.ts";
import type {
  ModelId,
  ModelTier,
  ModelTierMap,
  RoutingDecision,
  SessionOrigin,
} from "@/contracts";

/**
 * The default tier → model binding for this deployment (the labels the mock
 * agent + composer expose). A real deployment swaps this for its own bands; the
 * routing logic is unchanged.
 */
export const DEFAULT_TIER_MAP: ModelTierMap = {
  small: "Haiku 4.8",
  mid: "Sonnet 4.8",
  large: "Opus 4.8",
};

/** A resolved spawn model — the concrete id + the routing decision that picked
 * it (auditable: the tier, the blocklist flag, the reason, and whether the
 * toggle was on). The badge + audit read this; it never hides why a tier was
 * chosen. */
export interface ResolvedSpawn {
  /** The concrete model the session is spawned with. */
  model: ModelId;
  /** The decision that produced the tier (tier + blocklisted + reason). */
  decision: RoutingDecision;
  /** Whether the routing toggle was on for this resolution (audit/transparency). */
  routingEnabled: boolean;
}

export interface LiveModelRouterOptions {
  /**
   * The on/off toggle. DEFAULT OFF — routing is opt-in. When false, only the
   * blocklist invariant runs (everything else stays at the default large tier).
   */
  enabled?: boolean;
  /** The tier → model binding. Defaults to {@link DEFAULT_TIER_MAP}. */
  tierMap?: ModelTierMap;
}

export class LiveModelRouter {
  #enabled: boolean;
  readonly #map: ModelTierMap;

  constructor(opts: LiveModelRouterOptions = {}) {
    // DEFAULT OFF (the Decision-Gate lock). A missing flag is treated as off.
    this.#enabled = opts.enabled ?? false;
    this.#map = opts.tierMap ?? DEFAULT_TIER_MAP;
  }

  /** Whether routing is currently on. */
  get enabled(): boolean {
    return this.#enabled;
  }

  /** Flip the toggle (the UI on/off control / setting). */
  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
  }

  /** The tier → model binding this router resolves against. */
  get tierMap(): ModelTierMap {
    return this.#map;
  }

  /**
   * The TIER a fresh session of this origin should spawn at, honouring the
   * toggle AND the blocklist invariant.
   *
   *  - Blocklisted origin → `large`, ALWAYS (independent of the toggle). This is
   *    the runtime invariant: the toggle is checked AFTER the blocklist, so it
   *    can never reach a broker/review/untrusted surface.
   *  - Routing OFF → the DEFAULT (large) tier with the not-routed reason.
   *  - Routing ON → the pure origin decision (mechanical → small, analysis →
   *    mid, free-conversation/architecture → large).
   */
  decide(origin: SessionOrigin): RoutingDecision {
    // INVARIANT FIRST — structurally before the toggle. A blocklisted origin is
    // never downgraded, on or off.
    if (isBlocklisted(origin)) {
      return { tier: "large", blocklisted: true, reason: "blocklist-never-downgrade" };
    }
    // Toggle OFF → stay at the strongest model (routing only ever shrinks).
    if (!this.#enabled) {
      return { tier: DEFAULT_TIER, blocklisted: false, reason: "not-routed-default-tier" };
    }
    // Toggle ON → the deterministic origin decision (pure).
    return routeOrigin(origin);
  }

  /** Resolve the concrete spawn model for an origin (tier → model + the audit). */
  resolveSpawn(origin: SessionOrigin): ResolvedSpawn {
    const decision = this.decide(origin);
    return {
      model: resolveModel(decision.tier, this.#map),
      decision,
      routingEnabled: this.#enabled,
    };
  }

  /**
   * The escalated decision after a quality gate verdict (P1 — B5 as router
   * feedback). On a RED gate, step up one tier carrying the failure forward; on
   * GREEN, the current decision is unchanged. A blocklisted origin is already at
   * `large`, so escalation is a no-op there. This delegates to the pure
   * `escalateOnQuality` — the LiveModelRouter only owns the toggle + invariant.
   */
  escalateDecision(current: RoutingDecision, qualityFailed: boolean): RoutingDecision {
    return escalateOnQuality(current, qualityFailed);
  }

  /** Resolve a decision's tier to a concrete model (config binding). */
  modelFor(tier: ModelTier): ModelId {
    return resolveModel(tier, this.#map);
  }
}
