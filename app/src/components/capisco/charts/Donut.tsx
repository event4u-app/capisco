import { useTranslation } from "react-i18next";
import type { DonutSegment } from "@/contracts";

export interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  testid?: string;
}

const R = 54;
const C = 2 * Math.PI * R;

/**
 * Donut chart (build-spec §5/§6, prototype charts.jsx Donut). Each segment is
 * an SVG `<circle>` with a `stroke-dasharray`/`stroke-dashoffset` arc; the per-
 * segment circles + the legend percentages are the structure assertions.
 * Colours come from the chart palette (`segment.chartVar`), never hardcoded.
 */
export function Donut({ segments, size = 150, testid = "donut" }: DonutProps) {
  const { t } = useTranslation();
  const total = segments.reduce((n, s) => n + s.value, 0);

  if (!total) {
    return (
      <div
        data-testid={`${testid}-empty`}
        className="flex items-center justify-center py-6 text-micro text-muted-foreground"
      >
        {t("chart.empty")}
      </div>
    );
  }

  // Precompute each arc's length + cumulative offset (no mutation during render).
  const arcs = segments.reduce<{ seg: DonutSegment; len: number; offset: number }[]>(
    (rows, seg) => {
      const len = (C * seg.value) / total;
      const offset = rows.length ? rows[rows.length - 1].offset + rows[rows.length - 1].len : 0;
      rows.push({ seg, len, offset });
      return rows;
    },
    [],
  );

  return (
    <div data-testid={testid} className="flex items-center gap-4">
      <svg
        role="img"
        aria-label={t("chart.donutLabel")}
        viewBox="0 0 160 160"
        width={size}
        height={size}
        className="shrink-0"
      >
        <g transform="rotate(-90 80 80)">
          {arcs.map(({ seg, len, offset }) => (
            <circle
              key={seg.label}
              data-testid={`${testid}-seg-${seg.label}`}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={`hsl(var(${seg.chartVar}))`}
              strokeWidth="22"
              strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
              strokeDashoffset={(-offset).toFixed(2)}
            />
          ))}
        </g>
      </svg>
      <div className="flex flex-col gap-1.5">
        {segments.map((s) => (
          <span
            key={s.label}
            data-testid={`${testid}-legend-${s.label}`}
            className="flex items-center gap-1.5 text-micro text-muted-foreground"
          >
            <span
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ background: `hsl(var(${s.chartVar}))` }}
            />
            {s.label} <b className="text-foreground">{Math.round((s.value / total) * 100)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}
