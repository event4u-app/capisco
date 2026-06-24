import { useTranslation } from "react-i18next";

import { StatusDot } from "@/components/capisco/status-dot";
import { ModelBadge } from "@/components/capisco/model-badge";
import type { SubAgent } from "@/contracts";
import { formatTelemetry } from "./store";

/**
 * Child agents as small branch chips with their own StatusDot + model badge +
 * mono meta. The model badge (model-routing P3) names WHICH model runs WHICH
 * subtask — a subagent is a session-tree node, so it carries the same
 * transparency badge the session tab does (e.g. a circumscribed "write tests"
 * subtask routed to the small tier shows its own model, distinct from the
 * parent's). Reuses the shared {@link ModelBadge}; no override surface here (a
 * subagent inherits the orchestrator's routing decision — the human override is
 * a per-session control on the session tab, the parent of the tree).
 */
export function SubagentRow({ subs }: { subs: SubAgent[] }) {
  const { t } = useTranslation();
  if (!subs.length) return null;
  return (
    <div
      data-testid="subagent-row"
      aria-label={t("agents.subagents.label")}
      className="flex h-7 shrink-0 items-center gap-2 border-b border-border bg-editor px-4"
    >
      <span aria-hidden className="font-mono text-muted-foreground">
        └
      </span>
      {subs.map((sub) => (
        <span
          key={sub.id}
          data-testid={`subagent-chip-${sub.id}`}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11.5px] text-muted-foreground"
        >
          <StatusDot status={sub.status} size={7} />
          <span data-testid={`subagent-model-${sub.id}`}>
            <ModelBadge>{sub.model}</ModelBadge>
          </span>
          {sub.title}
          <span className="ml-0.5 font-mono text-[10.5px] text-muted-foreground">
            {formatTelemetry(sub.telemetry, sub.status)}
          </span>
        </span>
      ))}
    </div>
  );
}
