import { useTranslation } from "react-i18next";
import type { BurndownSeries } from "@/contracts";

export interface BurndownChartProps {
  ideal: BurndownSeries;
  /** Actual remaining; trailing nulls = future days (line stops at today). */
  actual: BurndownSeries;
  height?: number;
  /** CSS chart-palette var name for the actual (solid) line. */
  accentVar?: string;
  testid?: string;
}

const W = 640;
const PAD = { l: 34, r: 12, t: 12, b: 24 };

/**
 * Dual-burndown chart (build-spec §6, prototype charts.jsx BurndownChart):
 * ideal (dashed, muted) vs actual (solid, accent) that stops at "today" (the
 * last non-null actual). The two polylines + the "today" marker circle are the
 * SVG-structure assertions. Tokenized + themed; empty-state when no data.
 */
export function BurndownChart({
  ideal,
  actual,
  height = 200,
  accentVar = "--chart-line",
  testid = "burndown-chart",
}: BurndownChartProps) {
  const { t } = useTranslation();
  const accent = `hsl(var(${accentVar}))`;

  const actualNums = actual.filter((v): v is number => v != null);
  if (!ideal.length || !actualNums.length) {
    return (
      <div
        data-testid={`${testid}-empty`}
        className="flex items-center justify-center py-6 text-micro text-muted-foreground"
      >
        {t("chart.empty")}
      </div>
    );
  }

  const H = height;
  const n = ideal.length;
  const max = Math.max(...ideal.filter((v): v is number => v != null), ...actualNums) || 1;
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, n - 1);
  const y = (v: number) => PAD.t + (1 - v / max) * (H - PAD.t - PAD.b);

  const idealPts = ideal
    .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  const actualPts = actual
    .map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .filter(Boolean)
    .join(" ");
  // Index of the last non-null actual = "today".
  const lastIdx = actual.reduce<number>((a, v, i) => (v != null ? i : a), 0);
  const lastVal = actual[lastIdx] ?? null;
  const ticks = [max, max / 2, 0];

  return (
    <svg
      data-testid={testid}
      role="img"
      aria-label={t("chart.burndownLabel")}
      className="block w-full"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      {ticks.map((tk, i) => {
        const yy = PAD.t + (1 - tk / max) * (H - PAD.t - PAD.b);
        return (
          <g key={i}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yy}
              y2={yy}
              stroke="hsl(var(--chart-grid))"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={PAD.l - 6}
              y={yy + 3}
              className="fill-muted-foreground text-[9px]"
              textAnchor="end"
            >
              {Math.round(tk)}
            </text>
          </g>
        );
      })}
      <polyline
        data-testid={`${testid}-ideal`}
        points={idealPts}
        fill="none"
        stroke="hsl(var(--chart-ideal))"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        data-testid={`${testid}-actual`}
        points={actualPts}
        fill="none"
        stroke={accent}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {lastVal != null && (
        <circle
          data-testid={`${testid}-today`}
          cx={x(lastIdx)}
          cy={y(lastVal)}
          r="3"
          fill={accent}
        />
      )}
      {ideal.map(
        (_, i) =>
          i % 2 === 0 && (
            <text
              key={i}
              x={x(i)}
              y={H - 7}
              className="fill-muted-foreground text-[9px]"
              textAnchor="middle"
            >
              d{i}
            </text>
          ),
      )}
    </svg>
  );
}
