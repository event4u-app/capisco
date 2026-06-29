export interface SparklineProps {
  /** Event-count buckets (e.g. a Sentry issue's 24h trend). */
  data: number[];
  /** Stroke color (any CSS color, e.g. `var(--ds-error)`). */
  color: string;
  width?: number;
  height?: number;
  testid?: string;
}

/**
 * Tiny axis-less trend line (prototype `Sparkline` / `.spark`,
 * road-to-sentry-observability P0). A single polyline scaled to the data max,
 * no ticks, no labels — the issue-row trend glyph. `vectorEffect` keeps the
 * 1.5px stroke crisp under horizontal stretch.
 */
export function Sparkline({
  data,
  color,
  width = 80,
  height = 20,
  testid = "sparkline",
}: SparklineProps) {
  if (data.length < 2) {
    return <svg data-testid={`${testid}-empty`} width={width} height={height} className="spark" />;
  }
  const max = Math.max(...data, 1);
  const pts = data
    .map((v, i) => {
      const x = ((i / (data.length - 1)) * width).toFixed(1);
      const y = (height - (v / max) * (height - 2) - 1).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      data-testid={testid}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="spark"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
