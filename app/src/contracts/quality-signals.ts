/**
 * Pure fold of quality-tool results → shared-rail {@link SignalItem}s (the §5.2
 * surface). Lives in `contracts/` because it is a pure type-to-type transform
 * (QualityRunResult → SignalItem) consumed on BOTH sides of the sidecar boundary:
 * the real provider folds its runs server-side, and the IPC proxy borrows it as
 * a synchronous pure field (no round-trip) so `QualityProvider.toSignals` is
 * identical on either side by construction. No I/O, no node deps — browser-safe.
 */

import type { QualityRunResult } from "./quality.ts";
import type { SignalItem, SignalSeverity } from "./tooling.ts";

/** Map a tool result to its shared-rail severity. */
function severityFor(result: QualityRunResult): SignalSeverity {
  if (!result.ok) return "warning"; // errors → warning sev on the rail (operator attention)
  if (result.diagnostics.length > 0) return "idle"; // warnings only
  return "success"; // clean
}

/**
 * Pure fold of quality results → `SignalItem(source:"lint")`. One signal per
 * tool result: clean → success, warnings → idle, errors → warning.
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
