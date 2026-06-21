import { useTranslation } from "react-i18next";

import { StatusDot } from "@/components/capisco/status-dot";
import type { SubAgent } from "@/contracts";
import { formatTelemetry } from "./store";

/** Child agents as small branch chips with their own StatusDot + mono meta. */
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
          {sub.title}
          <span className="ml-0.5 font-mono text-[10.5px] text-muted-foreground">{formatTelemetry(sub.telemetry, sub.status)}</span>
        </span>
      ))}
    </div>
  );
}
