/**
 * Pure parsers for the quality tools (B5, road-to-quality-grounding). Mirrors
 * the `git-parse.ts` (B1) pattern: no process spawning here — these take a raw
 * tool-output string and return structured {@link Diagnostic}s, so they are
 * unit-testable on fixture strings without invoking a binary. The runner
 * (`real-quality-provider.ts`) spawns the tools and feeds their stdout here.
 *
 * Paths are normalised to worktree-relative (the runner passes `cwd`); the tool
 * facts (line/column/rule/severity) are reported verbatim — never inferred.
 */

import { realpathSync } from "node:fs";
import { posix, relative } from "node:path";
import type { Diagnostic, QualityFix } from "@/contracts";

/** Canonical (symlink-resolved) form of a path. Tools report the real path —
 * on macOS `/var/…` resolves to `/private/var/…` — so both sides must resolve
 * symlinks or `relative` yields a spurious `../…`. Falls back to the input when
 * the path no longer exists on disk. */
function canon(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

/** Make an absolute tool-reported path worktree-relative; pass through if
 * already relative or outside the worktree (kept honest, not hidden). */
function rel(cwd: string, file: string): string {
  if (!file) return "";
  if (!file.startsWith("/")) return file;
  const r = relative(canon(cwd), canon(file));
  // `relative` of a path outside cwd yields a `../…` — keep the absolute then.
  return r.startsWith("..") ? file : r;
}

// --- ESLint (--format json) -------------------------------------------------

interface EslintFix {
  range: [number, number];
  text: string;
}
interface EslintMessage {
  ruleId: string | null;
  severity: 0 | 1 | 2;
  message: string;
  line?: number;
  column?: number;
  fix?: EslintFix;
}
interface EslintFileResult {
  filePath: string;
  messages: EslintMessage[];
}

/** Parse eslint `--format json` stdout into diagnostics. A `fix` block on a
 * message means eslint can auto-apply it (`--fix`). */
export function parseEslint(cwd: string, stdout: string): Diagnostic[] {
  const text = stdout.trim();
  if (!text) return [];
  let parsed: EslintFileResult[];
  try {
    parsed = JSON.parse(text) as EslintFileResult[];
  } catch {
    return [];
  }
  const out: Diagnostic[] = [];
  for (const fileResult of parsed) {
    for (const m of fileResult.messages) {
      const fix: QualityFix | undefined = m.fix
        ? {
            description: m.ruleId
              ? `Auto-fixable via eslint --fix (${m.ruleId})`
              : "Auto-fixable via eslint --fix",
            autoApplicable: true,
            ruleId: m.ruleId ?? undefined,
          }
        : undefined;
      out.push({
        tool: "eslint",
        file: rel(cwd, fileResult.filePath),
        line: m.line,
        column: m.column,
        severity: m.severity === 2 ? "error" : m.severity === 1 ? "warning" : "info",
        rule: m.ruleId ?? undefined,
        message: m.message,
        fix,
      });
    }
  }
  return out;
}

// --- tsc (--pretty false) ---------------------------------------------------

/** `file(line,col): error TSxxxx: message` — one per line. */
const TSC_LINE = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.*)$/;

/** Parse `tsc --noEmit --pretty false` stdout into diagnostics. */
export function parseTsc(cwd: string, stdout: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const m = TSC_LINE.exec(line);
    if (!m) continue;
    out.push({
      tool: "tsc",
      file: rel(cwd, m[1]),
      line: Number(m[2]),
      column: Number(m[3]),
      severity: m[4] === "warning" ? "warning" : "error",
      rule: m[5],
      message: m[6],
    });
  }
  return out;
}

// --- PHPStan (--error-format=json, run in a container) ----------------------

interface PhpstanMessage {
  message: string;
  line?: number | null;
  identifier?: string;
  ignorable?: boolean;
}
interface PhpstanFile {
  messages?: PhpstanMessage[];
}
interface PhpstanJson {
  files?: Record<string, PhpstanFile>;
  /** Non-file-specific errors (config, parse) — kept honest, attached to no file. */
  errors?: string[];
}

/**
 * Parse PHPStan `--error-format=json` stdout into diagnostics. PHPStan runs
 * INSIDE the container (the PHP toolchain is not on the host), so its file paths
 * are container paths under the mount root (e.g. `/app/src/X.php`); pass that
 * `containerRoot` to relativise them back to worktree-relative. Every PHPStan
 * message is error-severity; the `identifier` (e.g. `return.type`) is the rule.
 */
export function parsePhpstan(containerRoot: string, stdout: string): Diagnostic[] {
  const text = stdout.trim();
  if (!text) return [];
  let parsed: PhpstanJson;
  try {
    parsed = JSON.parse(text) as PhpstanJson;
  } catch {
    return [];
  }
  const out: Diagnostic[] = [];
  for (const [path, file] of Object.entries(parsed.files ?? {})) {
    const relPath = path.startsWith("/") ? posix.relative(containerRoot, path) : path;
    for (const m of file.messages ?? []) {
      out.push({
        tool: "phpstan",
        file: relPath.startsWith("..") ? path : relPath,
        line: typeof m.line === "number" ? m.line : undefined,
        severity: "error",
        rule: m.identifier,
        message: m.message,
      });
    }
  }
  for (const e of parsed.errors ?? []) {
    out.push({ tool: "phpstan", file: "", severity: "error", message: e });
  }
  return out;
}

// --- vitest (--reporter=json) -----------------------------------------------

interface VitestAssertion {
  fullName: string;
  status: "passed" | "failed" | "pending" | "skipped" | "todo";
  failureMessages: string[];
}
interface VitestFileResult {
  name: string;
  assertionResults: VitestAssertion[];
}
interface VitestJson {
  testResults: VitestFileResult[];
}

/** First `at <abs-file>:line:col` frame in a failure message — the assertion
 * site, used to attach the diagnostic to a file/line. */
function firstFrame(cwd: string, message: string): { file: string; line?: number; column?: number } {
  for (const raw of message.split("\n")) {
    const m = /\s+at\s+(?:.*?\()?(\/[^():]+):(\d+):(\d+)\)?/.exec(raw);
    if (m && !m[1].includes("/node_modules/")) {
      return { file: rel(cwd, m[1]), line: Number(m[2]), column: Number(m[3]) };
    }
  }
  return { file: "" };
}

/** Parse vitest `--reporter=json` stdout into diagnostics (one per failing
 * assertion). Passing tests produce no diagnostic (the absence IS the signal). */
export function parseVitest(cwd: string, stdout: string): Diagnostic[] {
  const text = stdout.trim();
  if (!text) return [];
  let parsed: VitestJson;
  try {
    parsed = JSON.parse(text) as VitestJson;
  } catch {
    return [];
  }
  const out: Diagnostic[] = [];
  for (const fileResult of parsed.testResults ?? []) {
    for (const a of fileResult.assertionResults) {
      if (a.status !== "failed") continue;
      const msg = a.failureMessages[0] ?? "Test failed";
      const frame = firstFrame(cwd, msg);
      out.push({
        tool: "vitest",
        file: frame.file || rel(cwd, fileResult.name),
        line: frame.line,
        column: frame.column,
        severity: "error",
        rule: a.fullName,
        // First line of the failure message is the assertion (rest is the stack).
        message: msg.split("\n")[0].trim(),
      });
    }
  }
  return out;
}

// --- rector (process --dry-run --output-format=json) ------------------------

interface RectorFileDiff {
  file: string;
  diff?: string;
  applied_rectors?: string[];
}
interface RectorJson {
  totals?: { changed_files?: number; errors?: number };
  file_diffs?: RectorFileDiff[];
}

/** Short Rector rule name from the FQCN (`Rector\DeadCode\…\FooRector` → `FooRector`). */
function shortRule(fqcn: string): string {
  const parts = fqcn.split("\\");
  return parts[parts.length - 1] || fqcn;
}

/**
 * Parse Rector `--output-format=json` (dry-run) into diagnostics — one per
 * applied rector per file (advisory `warning`: a dry-run diff is a suggested
 * modernization, never a hard error). Paths are already worktree-relative when
 * Rector runs with cwd = the mount root (`-w`). Verified against Rector 2.5.
 */
export function parseRector(stdout: string): Diagnostic[] {
  const text = stdout.trim();
  if (!text) return [];
  let parsed: RectorJson;
  try {
    parsed = JSON.parse(text) as RectorJson;
  } catch {
    return [];
  }
  const out: Diagnostic[] = [];
  for (const fd of parsed.file_diffs ?? []) {
    const rectors = fd.applied_rectors?.length ? fd.applied_rectors : ["Rector"];
    for (const r of rectors) {
      out.push({
        tool: "rector",
        file: fd.file,
        severity: "warning",
        rule: r,
        message: `Rector: ${shortRule(r)} suggests a change`,
        fix: { description: `Apply ${shortRule(r)}`, autoApplicable: true },
      });
    }
  }
  return out;
}

// --- ecs (check --output-format=json) ---------------------------------------

interface EcsDiff {
  diff?: string;
  applied_checkers?: string[];
}
interface EcsError {
  line?: number;
  message?: string;
  source_class?: string;
}
interface EcsFile {
  errors?: EcsError[];
  diffs?: EcsDiff[];
}
interface EcsJson {
  totals?: { errors?: number; diffs?: number };
  files?: Record<string, EcsFile>;
}

/**
 * Parse ECS `--output-format=json` into diagnostics: non-fixable violations
 * (`files[].errors[]`, with line + source_class) and auto-fixable reformats
 * (`files[].diffs[].applied_checkers[]`). All `warning` severity — coding-style,
 * not a logic error — so they inform the rail without forcing a routing RED.
 * Paths are worktree-relative when ECS runs with cwd = the mount root (`-w`).
 * Verified against EasyCodingStandard 13.2.
 */
export function parseEcs(stdout: string): Diagnostic[] {
  const text = stdout.trim();
  if (!text) return [];
  let parsed: EcsJson;
  try {
    parsed = JSON.parse(text) as EcsJson;
  } catch {
    return [];
  }
  const out: Diagnostic[] = [];
  for (const [file, entry] of Object.entries(parsed.files ?? {})) {
    for (const e of entry.errors ?? []) {
      out.push({
        tool: "ecs",
        file,
        line: typeof e.line === "number" ? e.line : undefined,
        severity: "warning",
        rule: e.source_class,
        message: e.message ?? "Coding-standard violation",
      });
    }
    for (const d of entry.diffs ?? []) {
      const checkers = d.applied_checkers?.length ? d.applied_checkers : ["ECS"];
      for (const c of checkers) {
        out.push({
          tool: "ecs",
          file,
          severity: "warning",
          rule: c,
          message: `ECS: ${shortRule(c)} would reformat`,
          fix: { description: `Apply ${shortRule(c)}`, autoApplicable: true },
        });
      }
    }
  }
  return out;
}
