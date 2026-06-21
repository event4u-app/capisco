/**
 * Model-routing contract (Phase 4, token-economy / F5) — route a session to the
 * RIGHT model for its WORK, to save tokens without betraying the grounding thesis.
 *
 * DESIGN LOCK (feature-model-switch + Council): route by session ORIGIN/ROLE,
 * never by content. The naive "let a classifier read the prompt and guess
 * difficulty" is non-deterministic and would need the big model to judge whether
 * the big model is needed. Capisco already KNOWS a session's origin structurally
 * (the orchestrator spawned it) — so routing is a PURE, DETERMINISTIC function of
 * the origin, hence unit-testable and honest.
 *
 * THE ASYMMETRY (why this is conservative): mis-sending a small task to a big
 * model wastes cents; mis-sending an UNDERESTIMATED big task to a small model
 * returns "almost right" — exactly the market pain Capisco exists to fix. So:
 *  - small-first with QUALITY-DRIVEN ESCALATION (B5 red → bigger model, errors
 *    as context) — not "guess once",
 *  - a BLOCKLIST of origins that are NEVER downgraded (broker/permission, the
 *    AI-review itself, untrusted egress) — judgement/safety, never mechanical,
 *  - free conversation + architecture work are NOT routed (highest mis-class
 *    risk, lowest mechanical share),
 *  - DEFAULT OFF (it intervenes non-deterministically in the result; calibrate
 *    on real roadmap runs before it silently swaps models).
 */

import type { ModelId } from "./agents.ts";

/**
 * The capability tier a model sits in (vendor-neutral band). `small` = cheap/fast
 * (Haiku-class), `mid` = balanced (Sonnet-class), `large` = strongest (Opus-class).
 * Routing picks a tier; the tier → concrete {@link ModelId} mapping is config.
 */
export type ModelTier = "small" | "mid" | "large";

/**
 * Where a session came from — the routing input. The orchestrator KNOWS this at
 * spawn time (it is not a guess about content):
 *  - `roadmap-step:<category>` — a roadmap step (mechanical categories route small).
 *  - `subagent:<type>` — a subagent the orchestrator spawned for a circumscribed job.
 *  - `todo` — a ToDo→agent micro-task.
 *  - `free-conversation` — a human chat (NOT routed — highest mis-class risk).
 *  - `architecture` — design/architecture work (NOT routed).
 *  - `broker-decision` — a permission/capability decision (BLOCKLIST — never downgraded).
 *  - `ai-review` — the quality AI-review itself (BLOCKLIST — that IS the judgement).
 *  - `untrusted-egress` — egress derived from untrusted output (BLOCKLIST — safety).
 */
export type SessionOriginKind =
  | "roadmap-step"
  | "subagent"
  | "todo"
  | "free-conversation"
  | "architecture"
  | "broker-decision"
  | "ai-review"
  | "untrusted-egress";

/** Mechanical roadmap-step categories — circumscribed work that routes small. */
export type RoadmapStepCategory =
  | "mechanical" // e.g. apply a rector fix, rename, regen
  | "test-writing" // write tests to a given diff
  | "doc" // doc/comment edits
  | "analysis" // multi-file reasoning — route mid, not small
  | "design"; // design within a step — NOT downgraded (treated like architecture)

/** Subagent types the orchestrator spawns — each circumscribed by construction. */
export type SubagentType =
  | "test-writer"
  | "fixer" // apply a named fix
  | "summarizer"
  | "searcher"
  | "reviewer"; // a review subagent — BLOCKLIST (judgement), never downgraded

/** A session's origin — the deterministic routing input. */
export interface SessionOrigin {
  kind: SessionOriginKind;
  /** For `roadmap-step` — the step category. */
  stepCategory?: RoadmapStepCategory;
  /** For `subagent` — the subagent type. */
  subagentType?: SubagentType;
}

/** Why a routing decision picked the tier it did (auditable, deterministic). */
export type RoutingReason =
  | "blocklist-never-downgrade"
  | "not-routed-default-tier"
  | "mechanical-small"
  | "analysis-mid"
  | "escalated-on-quality";

/** A routing decision — the tier + whether it was on the blocklist + the reason. */
export interface RoutingDecision {
  tier: ModelTier;
  /** True when the origin is on the never-downgrade blocklist. */
  blocklisted: boolean;
  reason: RoutingReason;
}

/** Map a tier to a concrete model id (config — the tier→model binding). */
export interface ModelTierMap {
  small: ModelId;
  mid: ModelId;
  large: ModelId;
}
