/**
 * Heuristic prompt lints (composer-intelligence S3 · heuristic leg). Pure,
 * deterministic string rules — NO model roundtrip (the model-rewrite leg is a
 * separate P6 item). Returns `[]` for an empty buffer so the hint row is
 * boot-invisible by construction. Each rule is individually gated by the caller
 * so an un-calibrated lint can be disabled without code changes.
 */

export interface LintResult {
  id: string;
  message: string;
  severity: "hint" | "warn";
}

const IMPERATIVE = /^(fix|do|make|write|change|update|add|implement)\b/i;

/**
 * Lint a composer buffer. `hasAttachments` = whether any context chip (@file,
 * pasted, etc.) is attached — several rules soften when the prompt already
 * carries context.
 */
export function lintPrompt(value: string, hasAttachments: boolean): LintResult[] {
  const v = value.trim();
  if (!v) return [];
  const out: LintResult[] = [];
  if (v.length < 8) {
    out.push({ id: "too-short", severity: "hint", message: "Very short — add more detail?" });
  }
  if (IMPERATIVE.test(v) && !hasAttachments) {
    out.push({
      id: "vague-imperative",
      severity: "warn",
      message: "Imperative with no attached context — add a @file?",
    });
  }
  if (v.endsWith("?") && !hasAttachments && v.length < 40) {
    out.push({
      id: "question-no-context",
      severity: "hint",
      message: "Question with no context — attach a @file?",
    });
  }
  return out;
}
