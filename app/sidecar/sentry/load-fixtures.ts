/**
 * Node-side fixture loader (road-to-sentry-observability P0). Reads the
 * recorded JSON Sentry fixtures from disk and constructs the pure providers.
 * Kept separate from the providers themselves (which take fixture *objects*) so
 * the providers stay browser-safe and I/O-free — only this module touches
 * `node:fs`.
 *
 * The fixtures live next to this file under `fixtures/`. A real adapter swaps
 * this loader for an API client; the providers are unchanged.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { SentryFixture } from "./fixture-sentry-provider.ts";
import { FixtureSentryProvider } from "./fixture-sentry-provider.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

/** Recorded Sentry fixtures shipped with the build. */
export const SENTRY_FIXTURES = {
  capisco: "capisco.sentry.json",
} as const;

export type SentryFixtureId = keyof typeof SENTRY_FIXTURES;

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as T;
}

/** Load a recorded Sentry fixture as a {@link SentryFixture}. */
export function loadSentryFixture(id: SentryFixtureId): SentryFixture {
  return readJson<SentryFixture>(SENTRY_FIXTURES[id]);
}

/** Construct a {@link FixtureSentryProvider} from a recorded fixture id. */
export function createFixtureSentryProvider(id: SentryFixtureId = "capisco"): FixtureSentryProvider {
  return new FixtureSentryProvider(loadSentryFixture(id));
}
