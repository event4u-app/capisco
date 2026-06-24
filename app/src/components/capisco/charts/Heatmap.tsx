import { useTranslation } from "react-i18next";
import type { WorkHeatmap } from "@/contracts";

export interface HeatmapProps {
  grid: WorkHeatmap;
  /** Inclusive start / exclusive end of the configured working hours. */
  coreStart: number;
  coreEnd: number;
  testid?: string;
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Working-times heatmap (build-spec §5, prototype charts.jsx Heatmap): 7 days ×
 * 24 hours. Core hours (the configured working window, weekdays) recolour
 * green; off-hours / weekend recolour red — live as the selector changes. The
 * grid cells (`{testid}-cell-{d}-{h}`) and their `data-off` flag are the
 * structure assertions. Colours from `--chart-good` / `--chart-bad`, density
 * via per-cell opacity. Tokenized + themed; empty-state when the grid is empty.
 */
export function Heatmap({ grid, coreStart, coreEnd, testid = "heatmap" }: HeatmapProps) {
  const { t } = useTranslation();

  if (!grid.length) {
    return (
      <div
        data-testid={`${testid}-empty`}
        className="flex items-center justify-center py-6 text-micro text-muted-foreground"
      >
        {t("chart.empty")}
      </div>
    );
  }

  return (
    <div data-testid={testid} className="flex flex-col gap-[3px] text-[9px]">
      {/* Hour header */}
      <div className="flex gap-[3px]">
        <span className="w-7 shrink-0" />
        {Array.from({ length: 24 }, (_, h) => {
          const off = h < coreStart || h >= coreEnd;
          return (
            <span
              key={h}
              className={
                "flex-1 text-center tabular-nums " +
                (off ? "text-muted-foreground/60" : "text-muted-foreground")
              }
            >
              {h}
            </span>
          );
        })}
      </div>
      {grid.map((row, d) => {
        const weekend = d >= 5;
        return (
          <div
            key={d}
            className="flex items-center gap-[3px]"
            data-testid={`${testid}-row-${d}`}
          >
            <span
              className={
                "w-7 shrink-0 " +
                (weekend ? "text-muted-foreground/60" : "text-muted-foreground")
              }
            >
              {t(`chart.day.${DAY_KEYS[d]}`)}
            </span>
            {row.map((v, h) => {
              const off = weekend || h < coreStart || h >= coreEnd;
              const colorVar = off ? "--chart-bad" : "--chart-good";
              // Off-hours: opacity = activity (sparse). Core: 0.16..1 floor.
              const opacity = off ? Math.max(0.08, v) : 0.16 + v * 0.84;
              return (
                <span
                  key={h}
                  data-testid={`${testid}-cell-${d}-${h}`}
                  data-off={off || undefined}
                  title={`${t(`chart.day.${DAY_KEYS[d]}`)} ${h}:00 · ${Math.round(v * 100)}%`}
                  className="h-3.5 flex-1 rounded-[2px]"
                  style={{ background: `hsl(var(${colorVar}) / ${opacity.toFixed(2)})` }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
