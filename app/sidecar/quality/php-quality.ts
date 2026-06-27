/**
 * Containerized PHP quality runner (road-to-real-runtime P2). The PHP toolchain
 * is not on the host, so — per the roadmap — PHPStan runs INSIDE a container
 * (the official phpstan image) over the read-only-mounted worktree. Structured
 * `--error-format=json` output is folded into the same {@link QualityRunResult}
 * shape the TS pack uses, so a PHP RED verdict feeds the model-routing escalation
 * gate (`realQualityGate` → `verdictFromResults`) exactly like eslint/tsc.
 *
 * Rector (dry-run diff) and ECS / php-cs-fixer are the same primitive
 * (`runContainerTool`) plus their own parser — the follow-up PHP-pack tools.
 */

import { posix } from "node:path";

import type { QualityRunOptions, QualityRunResult } from "@/contracts";
import { runContainerTool } from "../runtime/devcontainer-exec.ts";
import { parsePhpstan } from "./quality-parse.ts";

const PHPSTAN_IMAGE = "ghcr.io/phpstan/phpstan:latest";
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
