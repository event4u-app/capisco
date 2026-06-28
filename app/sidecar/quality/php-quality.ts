/**
 * Containerized PHP quality runner (road-to-real-runtime P2). The PHP toolchain
 * is not on the host, so — per the roadmap — PHPStan runs INSIDE a container
 * (the official phpstan image) over the read-only-mounted worktree. Structured
 * `--error-format=json` output is folded into the same {@link QualityRunResult}
 * shape the TS pack uses, so a PHP RED verdict feeds the model-routing escalation
 * gate (`realQualityGate` → `verdictFromResults`) exactly like eslint/tsc.
 *
 * Rector (dry-run diff) and ECS / php-cs-fixer are the same primitive
 * (`runContainerTool`) plus their own parser. They have no clean per-tool image,
 * so they run from `jakzal/phpqa` (the PHP QA toolbox bundling both) with the
 * container cwd set to the mount root (`-w`) for worktree-relative paths. Both
 * are ADVISORY (style/modernization): their findings are `warning` severity, so
 * they enrich the signal rail but never force a model-routing RED (only
 * error-severity from phpstan/tsc does — see verdictFromResults).
 */

import { posix } from "node:path";

import type { QualityRunOptions, QualityRunResult } from "@/contracts";
import { runContainerTool } from "../runtime/devcontainer-exec.ts";
import { parseEcs, parsePhpstan, parseRector } from "./quality-parse.ts";

const PHPSTAN_IMAGE = "ghcr.io/phpstan/phpstan:latest";
/** jakzal/phpqa bundles Rector + ECS + php-cs-fixer (no clean per-tool image). */
const PHPQA_IMAGE = "jakzal/phpqa:latest";
const CONTAINER_DIR = "/app";

/**
 * Run PHPStan over a worktree in an ephemeral container. `level` defaults to 5;
 * `files` (worktree-relative) restricts the analysis, else the whole mount.
 */
export async function phpstanInContainer(
  cwd: string,
  opts: { level?: number; image?: string } & QualityRunOptions = {},
): Promise<QualityRunResult> {
  const start = performance.now();
  const level = opts.level ?? 5;
  const targets = (opts.files?.length ? opts.files : ["."]).map((p) => posix.join(CONTAINER_DIR, p));
  const { stdout, exitCode } = await runContainerTool({
    image: opts.image ?? PHPSTAN_IMAGE,
    hostDir: cwd,
    containerDir: CONTAINER_DIR,
    args: ["analyse", ...targets, `--level=${level}`, "--error-format=json", "--no-progress"],
  });
  const diagnostics = parsePhpstan(CONTAINER_DIR, stdout);
  const runtimeMs = Math.round(performance.now() - start);
  const ok = !diagnostics.some((d) => d.severity === "error");
  return { tool: "phpstan", ok, diagnostics, runtimeMs, exitCode };
}

/**
 * Run Rector in dry-run over a worktree (ephemeral `jakzal/phpqa` container) and
 * fold the suggested changes into a {@link QualityRunResult}. The project's
 * `rector.php` (worktree-relative, default at the root) is auto-discovered since
 * the container cwd is the mount root. Findings are advisory (`warning`), so
 * `ok` is true unless an error-severity diagnostic appears.
 */
export async function rectorInContainer(
  cwd: string,
  opts: { image?: string; config?: string } & QualityRunOptions = {},
): Promise<QualityRunResult> {
  const start = performance.now();
  const targets = opts.files?.length ? opts.files : ["."];
  const { stdout, exitCode } = await runContainerTool({
    image: opts.image ?? PHPQA_IMAGE,
    hostDir: cwd,
    containerDir: CONTAINER_DIR,
    workdir: CONTAINER_DIR,
    args: [
      "rector",
      "process",
      ...targets,
      "--dry-run",
      "--output-format=json",
      "--no-progress-bar",
      ...(opts.config ? [`--config=${opts.config}`] : []),
    ],
  });
  const diagnostics = parseRector(stdout);
  const runtimeMs = Math.round(performance.now() - start);
  const ok = !diagnostics.some((d) => d.severity === "error");
  return { tool: "rector", ok, diagnostics, runtimeMs, exitCode };
}

/**
 * Run ECS (EasyCodingStandard) over a worktree (ephemeral `jakzal/phpqa`
 * container) and fold the violations + auto-fixable reformats into a
 * {@link QualityRunResult}. The project's `ecs.php` is auto-discovered (cwd =
 * mount root). Findings are advisory (`warning`); `ok` stays true unless an
 * error-severity diagnostic appears.
 */
export async function ecsInContainer(
  cwd: string,
  opts: { image?: string; config?: string } & QualityRunOptions = {},
): Promise<QualityRunResult> {
  const start = performance.now();
  const targets = opts.files?.length ? opts.files : ["."];
  const { stdout, exitCode } = await runContainerTool({
    image: opts.image ?? PHPQA_IMAGE,
    hostDir: cwd,
    containerDir: CONTAINER_DIR,
    workdir: CONTAINER_DIR,
    args: [
      "ecs",
      "check",
      ...targets,
      "--output-format=json",
      "--no-progress-bar",
      ...(opts.config ? [`--config=${opts.config}`] : []),
    ],
  });
  const diagnostics = parseEcs(stdout);
  const runtimeMs = Math.round(performance.now() - start);
  const ok = !diagnostics.some((d) => d.severity === "error");
  return { tool: "ecs", ok, diagnostics, runtimeMs, exitCode };
}
