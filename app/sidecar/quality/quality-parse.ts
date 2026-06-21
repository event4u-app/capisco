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
import { relative } from "node:path";
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
