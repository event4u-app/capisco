import { cn } from "@/lib/utils";
import type { Metric } from "@/contracts";

export interface MetricCardProps {
  metric: Metric;
  testid?: string;
}

/**
 * DORA-style metric card (build-spec §5, prototype charts.jsx MetricCard):
 * label + optional tier badge, big value + optional good/bad delta, sub-line.
 * Fully tokenized (no hardcoded colour).
 */
export function MetricCard({ metric: m, testid }: MetricCardProps) {
  return (
    <div
      data-testid={testid ?? `metric-${m.label}`}
      className="flex flex-col gap-1 rounded-md border border-border bg-card p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-micro uppercase tracking-wide text-muted-foreground">{m.label}</span>
        {m.tier && (
          <span className="rounded-sm bg-accent px-1.5 py-0.5 text-[9px] font-medium uppercase text-accent-foreground">
            {m.tier}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums text-foreground">{m.value}</span>
        {m.delta && (
          <span
            data-testid={`${testid ?? `metric-${m.label}`}-delta`}
            className={cn("text-micro font-medium", m.good ? "text-success" : "text-destructive")}
          >
            {m.delta}
          </span>
        )}
      </div>
      {m.sub && <div className="text-micro text-muted-foreground">{m.sub}</div>}
    </div>
  );
}
