import * as React from "react";

/**
 * Minimal fixed-row windowing list (no external dep). Renders only the rows in
 * the viewport plus an overscan buffer — used for heavy lists (diffs, search,
 * transcripts) per the Tischstakes virtualization requirement (Overview §5).
 * Each rendered row carries `data-vrow` so DOM assertions can confirm windowing.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  overscan = 8,
  renderRow,
  className,
  style,
  testid,
}: {
  items: T[];
  rowHeight: number;
  overscan?: number;
  renderRow: (item: T, index: number) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  testid?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewport, setViewport] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setViewport(el.clientHeight);
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = items.length * rowHeight;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil((viewport || rowHeight) / rowHeight) + overscan * 2;
  const end = Math.min(items.length, start + visibleCount);

  const slice: React.ReactNode[] = [];
  for (let i = start; i < end; i++) {
    slice.push(
      <div
        key={i}
        data-vrow={i}
        style={{
          position: "absolute",
          top: i * rowHeight,
          left: 0,
          right: 0,
          height: rowHeight,
        }}
      >
        {renderRow(items[i], i)}
      </div>,
    );
  }

  return (
    <div
      ref={ref}
      data-testid={testid}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className={className}
      style={{ overflow: "auto", ...style }}
    >
      <div style={{ position: "relative", height: total, minWidth: "max-content" }}>
        {slice}
      </div>
    </div>
  );
}
