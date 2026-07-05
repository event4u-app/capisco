import { lintPrompt } from "@/lib/prompt-lints";

/**
 * Heuristic prompt-lint hints (composer-intelligence S3 · heuristic leg). Renders
 * a compact hint row under the textarea when the deterministic `lintPrompt` rules
 * fire. Boot-invisible: an empty buffer yields no lints → nothing renders, so the
 * composer goldens are unaffected. Never blocks send — purely advisory.
 */
export function LintHints({
  value,
  hasAttachments,
}: {
  value: string;
  hasAttachments: boolean;
}) {
  const lints = lintPrompt(value, hasAttachments);
  if (lints.length === 0) return null;
  return (
    <div className="cmp-lints" data-testid="composer-lints" role="status">
      {lints.map((l) => (
        <span
          key={l.id}
          className="cmp-lint"
          data-testid={`composer-lint-${l.id}`}
          data-severity={l.severity}
        >
          {l.message}
        </span>
      ))}
    </div>
  );
}
