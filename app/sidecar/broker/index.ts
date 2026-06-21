/**
 * Capability-Broker module barrel (B4). The broker is the un-bypassable
 * execution chokepoint — policy engine + secret vault + append-only audit +
 * prod read-only invariant + egress gate.
 */

export { Broker, type BrokerOptions } from "./capability-broker.ts";
export { GrantPolicyEngine } from "./policy-engine.ts";
export { InMemorySecretStore } from "./in-memory-secret-store.ts";
export { InMemoryAuditStore, looksLikeSecretValue } from "./audit-store.ts";
export { DEFAULT_GRANT_CONFIG } from "./default-grants.ts";
export { BrokerProvider } from "./broker-provider.ts";
