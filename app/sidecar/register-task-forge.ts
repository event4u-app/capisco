/**
 * Task- & Forge-provider wiring (B6, road-to-task-forge). Registers the
 * read-only fixture-backed task (Jira/Linear) and forge (GitHub/GitLab)
 * providers on the registry under stable ids.
 *
 * RPC-surface split (mirrors B2/B3/B4/B5): the {@link TaskProvider} /
 * {@link ForgeProvider} read-only methods are JSON-shaped — they serialise over
 * the wire. The {@link TicketLifecycle} orchestrator is NOT on the wire: it
 * holds the broker, the worktree primitive, the session store, and the
 * human-in-the-loop status-write resolver — all execution-layer concerns that
 * never serialise (a status write derived from untrusted ticket data must be
 * human-gated, not RPC-fired). The lifecycle is constructed in-process by the
 * consumer (the UI / a test) over the same registered providers.
 *
 * DEFERRED: live API tokens + webhooks + full bidirectional sync. The real
 * adapter swaps the fixture loader for an API client (token injected at the
 * execution layer, never on the wire); the wire surface is unchanged.
 */

import type { ProviderRegistry } from "./registry/registry.ts";
import { createFixtureForgeProvider, createFixtureTaskProvider } from "./task-forge/load-fixtures.ts";
import type { ForgeFixtureId, TaskFixtureId } from "./task-forge/load-fixtures.ts";
import type { FixtureForgeProvider } from "./task-forge/fixture-forge-provider.ts";
import type { FixtureTaskProvider } from "./task-forge/fixture-task-provider.ts";

/** The read-only task-system provider id on the wire (Jira/Linear). */
export const TASK_PROVIDER_ID = "task";
/** The read-only forge provider id on the wire (GitHub/GitLab). */
export const FORGE_PROVIDER_ID = "forge";

export interface RegisterTaskForgeOptions {
  /** Recorded task fixture to load (default `jira`). */
  task?: TaskFixtureId;
  /** Recorded forge fixture to load (default `github`). */
  forge?: ForgeFixtureId;
}

export function registerTaskForge(
  registry: ProviderRegistry,
  opts: RegisterTaskForgeOptions = {},
): { task: FixtureTaskProvider; forge: FixtureForgeProvider } {
  const task = createFixtureTaskProvider(opts.task ?? "jira");
  const forge = createFixtureForgeProvider(opts.forge ?? "github");
  registry.register(TASK_PROVIDER_ID, task as never);
  registry.register(FORGE_PROVIDER_ID, forge as never);
  return { task, forge };
}
