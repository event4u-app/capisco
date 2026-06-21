/**
 * Node-side fixture loader (B6). Reads the recorded JSON task/forge fixtures
 * from disk and constructs the pure providers. Kept separate from the providers
 * themselves (which take fixture *objects*) so the providers stay browser-safe
 * and I/O-free — only this module touches `node:fs`.
 *
 * The fixtures live next to this file under `fixtures/`. A real adapter swaps
 * this loader for an API client; the providers are unchanged.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ForgeFixture, TaskFixture } from "@/contracts";
import { FixtureTaskProvider } from "./fixture-task-provider.ts";
import { FixtureForgeProvider } from "./fixture-forge-provider.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

/** Recorded task fixtures shipped with the build. */
export const TASK_FIXTURES = {
  jira: "jira.task.json",
  linear: "linear.task.json",
} as const;

/** Recorded forge fixtures shipped with the build. */
export const FORGE_FIXTURES = {
  github: "github.forge.json",
  gitlab: "gitlab.forge.json",
} as const;

export type TaskFixtureId = keyof typeof TASK_FIXTURES;
export type ForgeFixtureId = keyof typeof FORGE_FIXTURES;

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, file), "utf8")) as T;
}

/** Load a recorded task fixture (Jira/Linear) as a {@link TaskFixture}. */
export function loadTaskFixture(id: TaskFixtureId): TaskFixture {
  return readJson<TaskFixture>(TASK_FIXTURES[id]);
}

/** Load a recorded forge fixture (GitHub/GitLab) as a {@link ForgeFixture}. */
export function loadForgeFixture(id: ForgeFixtureId): ForgeFixture {
  return readJson<ForgeFixture>(FORGE_FIXTURES[id]);
}

/** Construct a {@link FixtureTaskProvider} from a recorded fixture id. */
export function createFixtureTaskProvider(id: TaskFixtureId = "jira"): FixtureTaskProvider {
  return new FixtureTaskProvider(loadTaskFixture(id));
}

/** Construct a {@link FixtureForgeProvider} from a recorded fixture id. */
export function createFixtureForgeProvider(id: ForgeFixtureId = "github"): FixtureForgeProvider {
  return new FixtureForgeProvider(loadForgeFixture(id));
}
