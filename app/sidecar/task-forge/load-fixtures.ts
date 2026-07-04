/**
 * Node-side fixture loader (B6). The recorded JSON task/forge fixtures are
 * EMBEDDED via static imports so they ship INSIDE the compiled single-binary
 * sidecar: `bun build --compile` bundles imported JSON into the binary, whereas
 * a runtime `readFileSync(join(HERE, "fixtures", …))` is not embedded and
 * crashes the packaged binary with ENOENT (road-to-desktop-release P0). Kept
 * separate from the providers (which take fixture *objects*) so the providers
 * stay browser-safe and I/O-free.
 *
 * A real adapter swaps this loader for an API client; the providers are unchanged.
 */

import type { ForgeFixture, TaskFixture } from "@/contracts";
import { FixtureTaskProvider } from "./fixture-task-provider.ts";
import { FixtureForgeProvider } from "./fixture-forge-provider.ts";
import jiraTask from "./fixtures/jira.task.json" with { type: "json" };
import linearTask from "./fixtures/linear.task.json" with { type: "json" };
import githubForge from "./fixtures/github.forge.json" with { type: "json" };
import gitlabForge from "./fixtures/gitlab.forge.json" with { type: "json" };

/** Recorded task fixtures, embedded so they ship inside the compiled binary. */
const TASK_FIXTURE_DATA = {
  jira: jiraTask as TaskFixture,
  linear: linearTask as TaskFixture,
} as const;

/** Recorded forge fixtures, embedded so they ship inside the compiled binary. */
const FORGE_FIXTURE_DATA = {
  github: githubForge as ForgeFixture,
  gitlab: gitlabForge as ForgeFixture,
} as const;

export type TaskFixtureId = keyof typeof TASK_FIXTURE_DATA;
export type ForgeFixtureId = keyof typeof FORGE_FIXTURE_DATA;

/** Load a recorded task fixture (Jira/Linear) as a {@link TaskFixture}. */
export function loadTaskFixture(id: TaskFixtureId): TaskFixture {
  return TASK_FIXTURE_DATA[id];
}

/** Load a recorded forge fixture (GitHub/GitLab) as a {@link ForgeFixture}. */
export function loadForgeFixture(id: ForgeFixtureId): ForgeFixture {
  return FORGE_FIXTURE_DATA[id];
}

/** Construct a {@link FixtureTaskProvider} from a recorded fixture id. */
export function createFixtureTaskProvider(id: TaskFixtureId = "jira"): FixtureTaskProvider {
  return new FixtureTaskProvider(loadTaskFixture(id));
}

/** Construct a {@link FixtureForgeProvider} from a recorded fixture id. */
export function createFixtureForgeProvider(id: ForgeFixtureId = "github"): FixtureForgeProvider {
  return new FixtureForgeProvider(loadForgeFixture(id));
}
