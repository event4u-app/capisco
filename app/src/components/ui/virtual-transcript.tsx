import * as React from "react";

/**
 * Variable-height windowing list for the agent transcript (build-spec §4 /
 * Tischstakes virtualization). Unlike `VirtualList` (fixed row height), chat
 * blocks vary in height (messages, tool actions, permission prompts), so this
 * measures each rendered row with a `ResizeObserver`, caches the height in
 * state, and keeps a running offset table. Only the rows in the viewport plus
 * an overscan buffer are mounted — each carries `data-vrow` so DOM assertions
 * can confirm windowing with a 500-block session.
 *
 * Deterministic: heights settle from a fixed `estimatedRowHeight` to measured
 * values; no Date.now / Math.random.
 */
export function VirtualTranscript<T>({
  items,
  estimatedRowHeight,
  overscan = 6,
  renderRow,
  itemKey,
  className,
  style,
  testid,
}: {
  items: T[];
  estimatedRowHeight: number;
  overscan?: number;
  renderRow: (item: T, index: number) => React.ReactNode;
  itemKey: (item: T, index: number) => string;
  className?: string;
  style?: React.CSSProperties;
  testid?: string;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewport, setViewport] = React.useState(0);
  // Measured heights keyed by item index, held in state so reading them during
  // render is a plain state read (not a ref-during-render).
  const [heights, setHeights] = React.useState<ReadonlyMap<number, number>>(() => new Map());

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    setViewport(el.clientHeight);
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setRowHeight = React.useCallback((index: number, h: number) => {
    // Ignore non-positive measurements (e.g. jsdom returns 0) — they would
    // thrash the offset table and never settle.
    if (h <= 0) return;
    setHeights((prev) => {
      if (prev.get(index) === h) return prev;
      const next = new Map(prev);
      next.set(index, h);
      return next;
    });
  }, []);

  // Offset table — prefix sums of (measured or estimated) row heights.
  const offsets = React.useMemo(() => {
    const out = new Array<number>(items.length + 1);
    out[0] = 0;
    for (let i = 0; i < items.length; i++) {
      out[i + 1] = out[i] + (heights.get(i) ?? estimatedRowHeight);
    }
    return out;
  }, [items.length, heights, estimatedRowHeight]);

  const total = offsets[items.length];

  // Binary search for the first row whose bottom edge is past the viewport top.
  const firstVisible = React.useMemo(() => {
    let lo = 0;
    let hi = items.length - 1;
    if (hi < 0) return 0;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offsets[mid + 1] <= scrollTop) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }, [items.length, offsets, scrollTop]);

  const start = Math.max(0, firstVisible - overscan);
  let end = start;
  const limit = scrollTop + (viewport || estimatedRowHeight);
  while (end < items.length && offsets[end] < limit) end++;
  end = Math.min(items.length, end + overscan);

  const slice: React.ReactNode[] = [];
  for (let i = start; i < end; i++) {
    slice.push(
      <Row key={itemKey(items[i], i)} index={i} top={offsets[i]} onMeasure={setRowHeight}>
        {renderRow(items[i], i)}
      </Row>,
    );
  }

  return (
    <div
      ref={scrollRef}
      data-testid={testid}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={className}
      style={{ overflow: "auto", ...style }}
    >
      <div style={{ position: "relative", height: total }}>{slice}</div>
    </div>
  );
}

function Row({
  index,
  top,
  onMeasure,
  children,
}: {
  index: number;
  top: number;
  onMeasure: (index: number, height: number) => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => onMeasure(index, el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, onMeasure]);
  return (
    <div ref={ref} data-vrow={index} style={{ position: "absolute", top, left: 0, right: 0 }}>
      {children}
    </div>
  );
}
