/**
 * Quality-grounding contracts (B5, road-to-quality-grounding).
 *
 * The QualityProvider runs first-party quality tools (eslint / tsc / vitest) in
 * a worktree, parses their output into structured {@link Diagnostic}s plus
 * applicable {@link QualityFix}es, and folds them onto the shared signal surface
 * as `SignalItem(source:"lint")` (tooling.ts §5.2). These are the *facts* that
 * **ground** the AI ("almost right" → verified): the agent reasons against
 * real tool output, not a guess.
 *
 * The runner is real and auto-verifiable (eslint / tsc / vitest are installed,
 * run hermetically against fixture files in a temp worktree). The LLM-review
 * layer that consumes these facts is a separate, deferred seam — see
 * {@link ./ai-review}.
 *
 * Language packs (phpstan / rector / ecs etc.) are expressed as the
 * {@link LanguagePack} INTERFACE only; concrete packs are deferred (each needs
 * its own toolchain present). The eslint/tsc/vitest runners ARE a concrete
 * TypeScript language pack behind the same shape.
 */

import type { SignalItem } from "./tooling.ts";

/** A quality tool the runner can invoke. The TS pack ships eslint/tsc/vitest;
 * other packs (phpstan/rector/ecs) declare their own tool ids — `string` keeps
 * the surface open without baking a closed enum. */
export type QualityToolId = "eslint" | "tsc" | "vitest" | (string & {});

/** Diagnostic severity, normalised across tools (eslint warning/error, tsc
 * error, vitest fail → here). `info` is for non-failing notes. */
export type DiagnosticSeverity = "error" | "warning" | "info";

/** A single structured finding parsed from a tool's output. Tool-agnostic so
 * the UI / signal surface / AI-review layer consume one shape regardless of
 * which pack produced it. */
export interface Diagnostic {
  /** Which tool produced this finding. */
  tool: QualityToolId;
  /** Worktree-relative file path the finding is about (or "" for whole-run). */
  file: string;
  /** 1-based line, when the tool reports one. */
  line?: number;
  /** 1-based column, when the tool reports one. */
  column?: number;
  severity: DiagnosticSeverity;
  /** Tool rule id, e.g. eslint `prefer-const` or tsc `TS2322`. */
  rule?: string;
  message: string;
  /** A machine-applicable fix the tool offered for this finding, if any. */
  fix?: QualityFix;
}

/**
 * A fix a tool reported as applicable for a {@link Diagnostic}. The provider
 * surfaces these as *facts* (the tool says it can fix this); applying them is a
 * separate, gated action — the broker (B4) mediates the actual file write, this
 * contract never writes on its own.
 */
export interface QualityFix {
  /** Human description, e.g. "Replace `let` with `const`". */
  description: string;
  /** True when the tool can apply this automatically (eslint `--fix`). */
  autoApplicable: boolean;
  /** The eslint rule id whose `--fix` would apply this, when relevant. */
  ruleId?: string;
}

/** The outcome of running one tool over a worktree (or a file subset). */
export interface QualityRunResult {
  tool: QualityToolId;
  /** True when the tool exited clean (no error-severity diagnostics). */
  ok: boolean;
  diagnostics: Diagnostic[];
  /** Wall-clock duration of the tool run in ms (telemetry, never a guess). */
  runtimeMs: number;
  /** Raw exit code the tool process returned (informational; parsing is the truth). */
  exitCode: number | null;
}

/** Options for a quality run. */
export interface QualityRunOptions {
  /** Restrict the run to these worktree-relative paths (tool-dependent). */
  files?: string[];
}

/**
 * The quality-tool runner seam. Runs tools in a worktree (`cwd`), parses output
 * → diagnostics + fixes, and projects diagnostics onto the shared signal rail.
 * Real impl (sidecar) shells out to the installed binaries; every method is
 * `Promise<…>` (the real adapter spawns processes).
 */
export interface QualityProvider {
  /** Tool ids this provider can run in the given worktree. */
  availableTools(cwd: string): Promise<QualityToolId[]>;
  /** Run ONE tool over the worktree, parsed to a structured result. */
  run(cwd: string, tool: QualityToolId, options?: QualityRunOptions): Promise<QualityRunResult>;
  /** Run every available tool and return one result per tool. */
  runAll(cwd: string, options?: QualityRunOptions): Promise<QualityRunResult[]>;
  /**
   * Project the diagnostics of one or more results onto the shared signal
   * surface as `SignalItem(source:"lint")` — the §5.2 fold. Pure (no run).
   */
  toSignals(results: QualityRunResult[]): SignalItem[];
}

/**
 * A language pack groups the quality tools for one ecosystem behind a stable
 * shape. The eslint/tsc/vitest runners ARE the TypeScript pack; phpstan / rector
 * / ecs / php-cs-fixer would be a PHP pack, ruff / mypy a Python pack, etc.
 *
 * Concrete non-TS packs are **deferred** — each requires its own toolchain
 * present (a thin swap behind this interface once the binary exists). This
 * contract is the seam, not an implementation.
 */
export interface LanguagePack {
  /** Stable pack id, e.g. "typescript", "php", "python". */
  id: string;
  /** Human label, e.g. "TypeScript (eslint · tsc · vitest)". */
  label: string;
  /** The tools this pack offers. */
  tools: QualityToolId[];
  /**
   * True when the pack's tools are present in `cwd` (a real pack probes the
   * binaries / config; a deferred pack returns false until its toolchain lands).
   */
  isAvailable(cwd: string): Promise<boolean>;
}
