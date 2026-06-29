import { useTranslation } from "react-i18next";

export interface LineChartProps {
  data: number[];
  labels: string[];
  /** CSS chart-palette var name (e.g. "--chart-1"). Resolved as hsl(var(...)). */
  colorVar?: string;
  /**
   * Explicit stroke color (any CSS color, e.g. `var(--ds-warning)`). Overrides
   * `colorVar` when set — used by the Sentry performance charts whose colors are
   * bound to the design-system level tokens (spec §9).
   */
  color?: string;
  height?: number;
  /** Tick-value formatter (e.g. (v) => `${v}k`). */
  fmt?: (v: number) => string;
  testid?: string;
  "aria-label"?: string;
}

const W = 640;
const PAD = { l: 38, r: 10, t: 12, b: 22 };

/**
 * Responsive inline-SVG line chart (build-spec §5, prototype charts.jsx
 * LineChart) — tokenized, themed, with an empty-state. The polyline `points`
 * and per-point `<circle>`s are the SVG-structure assertions the visual specs
 * check. `vectorEffect="non-scaling-stroke"` keeps 1–2px strokes crisp under
 * the `preserveAspectRatio="none"` horizontal stretch.
 */
export function LineChart({
  data,
  labels,
  colorVar = "--chart-line",
  color: colorOverride,
  height = 150,
  fmt = (v) => String(v),
  testid = "line-chart",
  "aria-label": ariaLabel,
}: LineChartProps) {
  const { t } = useTranslation();
  const color = colorOverride ?? `hsl(var(${colorVar}))`;

  if (!data.length) {
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
  const max = Math.max(...data);
  const min = Math.min(0, ...data);
  const span = max - min || 1;
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => PAD.t + (1 - (v - min) / span) * (H - PAD.t - PAD.b);
  const pts = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [max, min + span * 0.5, min];

  return (
    <svg
      data-testid={testid}
      role="img"
      aria-label={ariaLabel ?? t("chart.lineLabel")}
      className="block w-full"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      {ticks.map((tk, i) => {
        const yy = PAD.t + (1 - (tk - min) / span) * (H - PAD.t - PAD.b);
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
              {fmt(Math.round(tk))}
            </text>
          </g>
        );
      })}
      <polyline
        data-testid={`${testid}-line`}
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {data.map((v, i) => (
        <circle
          key={i}
          data-testid={`${testid}-point-${i}`}
          cx={x(i)}
          cy={y(v)}
          r="2.5"
          fill="hsl(var(--editor))"
          stroke={color}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {labels.map(
        (l, i) =>
          i % 2 === 0 && (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              className="fill-muted-foreground text-[9px]"
              textAnchor="middle"
            >
              {l}
            </text>
          ),
      )}
    </svg>
  );
}
