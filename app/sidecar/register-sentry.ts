/**
 * Sentry provider wiring (road-to-sentry-observability P0). Registers the
 * read-only fixture-backed Sentry provider on the registry under a stable id.
 *
 * DEFERRED: live API tokens + webhooks + write surface (resolve/ignore/assign).
 * The real adapter swaps the fixture loader for an API client (token injected
 * at the execution layer, never on the wire); the wire surface is unchanged.
 */

import type { ProviderRegistry } from "./registry/registry.ts";
import { createFixtureSentryProvider } from "./sentry/load-fixtures.ts";
import type { SentryFixtureId } from "./sentry/load-fixtures.ts";
import type { FixtureSentryProvider } from "./sentry/fixture-sentry-provider.ts";

/** The read-only Sentry provider id on the wire. */
export const SENTRY_PROVIDER_ID = "sentry";

export interface RegisterSentryOptions {
  /** Recorded Sentry fixture to load (default `capisco`). */
  fixture?: SentryFixtureId;
}

export function registerSentry(
  registry: ProviderRegistry,
  opts: RegisterSentryOptions = {},
): { sentry: FixtureSentryProvider } {
  const sentry = createFixtureSentryProvider(opts.fixture ?? "capisco");
  registry.register(SENTRY_PROVIDER_ID, sentry as never);
  return { sentry };
}
