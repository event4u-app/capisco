/**
 * Deterministic model router (Phase 4, token-economy / F5). PURE FUNCTIONS of a
 * session's ORIGIN → a model tier. No content inspection, no LLM call, no
 * randomness — so the routing is unit-testable and honest (the Council lock).
 *
 *   routeOrigin(origin)          → the tier for a fresh session by its origin
 *   escalate(tier)               → the next-larger tier (quality-driven, B5 red)
 *   isBlocklisted(origin)        → never-downgrade origins (broker/review/untrusted)
 *   resolveModel(decision, map)  → tier → concrete ModelId
 *
 * BLOCKLIST INVARIANT: broker/permission decisions, the AI-review itself, an
 * untrusted-egress session, and a `reviewer` subagent are NEVER downgraded —
 * they always route `large`. This is an invariant, not a default (same spirit as
 * prod-read-only): a weaker model must never make a judgement/safety call.
 *
 * NOT ROUTED: free conversation + architecture/design → the default (large)
 * tier. The mis-classification risk is highest and the mechanical share lowest
 * there; routing stays scoped to mechanical work (roadmap steps, subtasks, ToDo).
 */

import type {
  ModelId,
  ModelTier,
  ModelTierMap,
  RoutingDecision,
  SessionOrigin,
} from "@/contracts";

/** Tier order, smallest → largest (for escalation + comparison). */
const TIER_ORDER: ModelTier[] = ["small", "mid", "large"];

/** The default (un-routed) tier — the strongest. Routing only ever shrinks from here. */
export const DEFAULT_TIER: ModelTier = "large";

/**
 * Origins that are NEVER downgraded — judgement / safety, never mechanical work.
 * Broker/permission decisions, the AI-review itself, untrusted egress, and a
 * `reviewer` subagent. A pure predicate over the origin (no content).
 */
export function isBlocklisted(origin: SessionOrigin): boolean {
  if (
    origin.kind === "broker-decision" ||
    origin.kind === "ai-review" ||
    origin.kind === "untrusted-egress"
  ) {
    return true;
  }
  if (origin.kind === "subagent" && origin.subagentType === "reviewer") return true;
  return false;
}

/**
 * Route a fresh session to a tier by its origin. PURE + DETERMINISTIC.
 *  - Blocklisted origin → `large` (never downgraded).
 *  - Free conversation / architecture → `large` (not routed).
 *  - Mechanical roadmap step / mechanical subagent / ToDo → `small`.
 *  - Analysis-category step → `mid` (multi-file reasoning, not trivial).
 *  - A `design`-category step → `large` (treated like architecture, not downgraded).
 */
export function routeOrigin(origin: SessionOrigin): RoutingDecision {
  if (isBlocklisted(origin)) {
    return { tier: "large", blocklisted: true, reason: "blocklist-never-downgrade" };
  }

  switch (origin.kind) {
    case "free-conversation":
    case "architecture":
      return { tier: DEFAULT_TIER, blocklisted: false, reason: "not-routed-default-tier" };

    case "roadmap-step": {
      switch (origin.stepCategory) {
        case "analysis":
          return { tier: "mid", blocklisted: false, reason: "analysis-mid" };
        case "design":
          // Design within a step is judgement work — not downgraded.
          return { tier: "large", blocklisted: false, reason: "not-routed-default-tier" };
        case "mechanical":
        case "test-writing":
        case "doc":
        default:
          return { tier: "small", blocklisted: false, reason: "mechanical-small" };
      }
    }

    case "subagent": {
      // `reviewer` was caught by the blocklist above. The rest are circumscribed.
      switch (origin.subagentType) {
        case "summarizer":
        case "searcher":
        case "fixer":
        case "test-writer":
        default:
          return { tier: "small", blocklisted: false, reason: "mechanical-small" };
      }
    }

    case "todo":
      return { tier: "small", blocklisted: false, reason: "mechanical-small" };

    default:
      // Unknown origin → conservative default (never silently downgrade).
      return { tier: DEFAULT_TIER, blocklisted: false, reason: "not-routed-default-tier" };
  }
}

/** The next-larger tier (escalation). `large` is the ceiling (no-op at the top). */
export function escalate(tier: ModelTier): ModelTier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.min(i + 1, TIER_ORDER.length - 1)];
}

/**
 * Quality-driven escalation (B5 red → bigger model). Given the current decision
 * and whether the quality gate FAILED (a deterministic, grounded signal — not a
 * confidence score), return the escalated decision. A blocklisted origin is
 * already at `large` (escalation is a no-op there). Escalation never EXCEEDS
 * `large` and never downgrades.
 */
export function escalateOnQuality(
  current: RoutingDecision,
  qualityFailed: boolean,
): RoutingDecision {
  if (!qualityFailed) return current;
  const next = escalate(current.tier);
  if (next === current.tier) return current; // already at the ceiling
  return { tier: next, blocklisted: current.blocklisted, reason: "escalated-on-quality" };
}

/** Resolve a routing decision's tier to a concrete model id (config binding). */
export function resolveModel(tier: ModelTier, map: ModelTierMap): ModelId {
  return map[tier];
}

/** Compare two tiers — true when `a` is strictly smaller than `b`. */
export function tierLessThan(a: ModelTier, b: ModelTier): boolean {
  return TIER_ORDER.indexOf(a) < TIER_ORDER.indexOf(b);
}
