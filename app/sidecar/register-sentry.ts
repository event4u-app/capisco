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
import { SentryKillSwitch, createGatedSentryProvider } from "./sentry/sentry-kill-switch.ts";

/** The read-only Sentry provider id on the wire. */
export const SENTRY_PROVIDER_ID = "sentry";
/** The runtime kill-switch control surface id on the wire. */
export const SENTRY_CONTROL_PROVIDER_ID = "sentry-control";

export interface RegisterSentryOptions {
  /** Recorded Sentry fixture to load (default `capisco`). */
  fixture?: SentryFixtureId;
  /**
   * Force the integration off regardless of the runtime toggle (remote-manifest
   * override). Defaults to the `CAPISCO_SENTRY_DISABLED` env flag so an operator
   * can boot with Sentry hard-off; the deferred manifest fetch feeds the same flag.
   */
  forceDisabled?: boolean;
}

export function registerSentry(
  registry: ProviderRegistry,
  opts: RegisterSentryOptions = {},
): { sentry: FixtureSentryProvider; kill: SentryKillSwitch } {
  const sentry = createFixtureSentryProvider(opts.fixture ?? "capisco");
  const kill = new SentryKillSwitch({
    forceDisabled: opts.forceDisabled ?? process.env.CAPISCO_SENTRY_DISABLED === "1",
  });
  // The wire provider is the GATED one — a flipped switch returns empty reads and
  // makes no upstream call, so "off" is inert, not merely hidden.
  registry.register(SENTRY_PROVIDER_ID, createGatedSentryProvider(sentry, kill) as never);
  registry.register(SENTRY_CONTROL_PROVIDER_ID, {
    isEnabled: () => Promise.resolve(kill.enabled()),
    setEnabled: (on: boolean) => {
      kill.setEnabled(on);
      return Promise.resolve();
    },
    isForced: () => Promise.resolve(kill.forced()),
  } as never);
  return { sentry, kill };
}
