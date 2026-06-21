/**
 * Cross-Project Session-Bridge module barrel (road-to-cross-project-knowledge
 * P2). The full lethal-trifecta surface with two legs broken: the egress
 * human-gate (AK-C3) and the redaction/curated-excerpt quarantine (AK-C1+C2).
 */

export {
  CrossProjectBridgeImpl,
  createProjectStoreFederation,
  type CrossProjectBridgeOptions,
  type EgressResolver,
  type ReadResolver,
  type PerformEgress,
} from "./cross-project-bridge.ts";
export { redactToExcerpt, carriesSecret, MAX_SNIPPET } from "./redact-excerpt.ts";
