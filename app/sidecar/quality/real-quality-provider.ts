/**
 * Real QualityProvider (B5, road-to-quality-grounding) — the first-party
 * quality-tool runner. Runs eslint / tsc / vitest in a worktree, parses their
 * output (via the pure `quality-parse.ts` parsers) into structured diagnostics
 * + applicable fixes, and folds them onto the shared signal surface as
 * `SignalItem(source:"lint")`.
 *
 * This is REAL and auto-verifiable: the binaries are installed, the provider
 * shells out to them with `execFile` (no shell — same posture as `git-exec.ts`),
 * and the tests run it against hermetic fixture files in a temp worktree. It is
 * the concrete TypeScript {@link LanguagePack}; phpstan/rector/ecs packs are the
 * deferred interface in `contracts/quality.ts`.
 *
 * Execution posture: like git-exec, the tools are invoked with an explicit argv
 * (no shell interpolation). When the broker (B4) mediates quality runs, this is
 * the first-party execution primitive it gates — not an open shell escape.
 */

import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type {
  Diagnostic,
  LanguagePack,
  QualityProvider,
  QualityRunOptions,
  QualityRunResult,
  QualityToolId,
  SignalItem,
  SignalSeverity,
} from "@/contracts";
import { parseEslint, parseTsc, parseVitest } from "./quality-parse.ts";

/** Repo root (`app/`) — used to resolve the installed tool binaries so a fixture
 * worktree without its own node_modules can still be linted/typechecked/tested. */
const APP_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const BIN = (name: string): string => join(APP_ROOT, "node_modules", ".bin", name);

const MAX_BUFFER = 10 * 1024 * 1024;

interface RawRun {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/** Run a tool binary with an explicit argv (no shell). Never rejects — a
 * non-zero exit is expected (it means the tool found problems); the parser is
 * the source of truth, not the exit code. */
function runTool(cwd: string, bin: string, args: string[]): Promise<RawRun> {
  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      { cwd, maxBuffer: MAX_BUFFER, encoding: "utf8" },
      (error, stdout, stderr) => {
        const exitCode =
          error && typeof (error as { code?: unknown }).code === "number"
            ? ((error as { code: number }).code)
            : error
              ? null
              : 0;
        resolve({ stdout, stderr, exitCode });
      },
    );
  });
}

const TS_TOOLS: QualityToolId[] = ["eslint", "tsc", "vitest"];

export class RealQualityProvider implements QualityProvider {
  // The runner ships the TypeScript pack; other packs are the deferred
  // interface. `cwd` is part of the contract (a real multi-pack runner probes
  // the worktree); the TS pack is always available so it is not consulted here.
  async availableTools(cwd: string): Promise<QualityToolId[]> {
    void cwd;
    return [...TS_TOOLS];
  }

  async run(
    cwd: string,
    tool: QualityToolId,
    options: QualityRunOptions = {},
  ): Promise<QualityRunResult> {
    const start = performance.now();
    let diagnostics: Diagnostic[];
    let raw: RawRun;
    switch (tool) {
      case "eslint": {
        const targets = options.files ?? ["."];
        raw = await runTool(cwd, BIN("eslint"), ["--format", "json", ...targets]);
        diagnostics = parseEslint(cwd, raw.stdout);
        break;
      }
      case "tsc": {
        const args = ["--noEmit", "--strict", "--pretty", "false"];
        if (options.files?.length) args.push(...options.files);
        raw = await runTool(cwd, BIN("tsc"), args);
        diagnostics = parseTsc(cwd, raw.stdout);
        break;
      }
      case "vitest": {
        const targets = options.files ?? [];
        raw = await runTool(cwd, BIN("vitest"), [
          "run",
          "--reporter=json",
          "--no-color",
          "--root",
          cwd,
          ...targets,
        ]);
        diagnostics = parseVitest(cwd, raw.stdout);
        break;
      }
      default:
        throw new Error(`Unknown quality tool: ${tool} (TS pack ships eslint/tsc/vitest)`);
    }
    const runtimeMs = Math.round(performance.now() - start);
    const ok = !diagnostics.some((d) => d.severity === "error");
    return { tool, ok, diagnostics, runtimeMs, exitCode: raw.exitCode };
  }

  async runAll(cwd: string, options?: QualityRunOptions): Promise<QualityRunResult[]> {
    const tools = await this.availableTools(cwd);
    const results: QualityRunResult[] = [];
    for (const tool of tools) {
      results.push(await this.run(cwd, tool, options));
    }
    return results;
  }

  toSignals(results: QualityRunResult[]): SignalItem[] {
    return resultsToSignals(results);
  }
}

/** Map a tool result to its shared-rail severity. */
function severityFor(result: QualityRunResult): SignalSeverity {
  if (!result.ok) return "warning"; // errors → warning sev on the rail (operator attention)
  if (result.diagnostics.length > 0) return "idle"; // warnings only
  return "success"; // clean
}

/**
 * Pure fold of quality results → `SignalItem(source:"lint")` (the §5.2 shared
 * surface). One signal per tool result: clean → success, warnings → idle,
 * errors → warning. Exported standalone so it is unit-testable without a run.
 */
export function resultsToSignals(results: QualityRunResult[]): SignalItem[] {
  return results.map((r) => {
    const errors = r.diagnostics.filter((d) => d.severity === "error").length;
    const warnings = r.diagnostics.filter((d) => d.severity === "warning").length;
    let sub: string;
    if (r.diagnostics.length === 0) {
      sub = `No problems found · ${r.runtimeMs}ms`;
    } else {
      const parts: string[] = [];
      if (errors) parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
      if (warnings) parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
      const first = r.diagnostics[0];
      const loc = first.file ? ` · ${first.file}${first.line ? `:${first.line}` : ""}` : "";
      sub = `${parts.join(", ")}${loc}`;
    }
    return {
      id: `lint-${r.tool}`,
      source: "lint",
      sev: severityFor(r),
      title: `${r.tool} — ${r.ok ? (r.diagnostics.length ? "warnings" : "clean") : "errors"}`,
      sub,
    } satisfies SignalItem;
  });
}

/** The concrete TypeScript language pack — the one real pack today (eslint /
 * tsc / vitest). Other packs (php, python) are the deferred interface. */
export const typescriptPack: LanguagePack = {
  id: "typescript",
  label: "TypeScript (eslint · tsc · vitest)",
  tools: [...TS_TOOLS],
  isAvailable: async (cwd: string) => {
    void cwd;
    return true;
  },
};
