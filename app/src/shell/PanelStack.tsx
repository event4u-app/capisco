import * as React from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { railItem } from "./tools";
import { useLayout } from "./store";

function PaneHeader({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { icon, labelKey } = railItem(id);
  return (
    <div
      data-testid={`pane-header-${id}`}
      className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 text-micro font-medium uppercase tracking-wide text-muted-foreground"
    >
      <Icon icon={icon} size={12} />
      <span className="truncate">{t(labelKey)}</span>
      <button
        type="button"
        aria-label={t("panel.close")}
        title={t("panel.close")}
        data-testid={`pane-close-${id}`}
        onClick={onClose}
        className="ml-auto flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <X className="size-3" strokeWidth={1.6} aria-hidden />
      </button>
    </div>
  );
}

function Pane({
  id,
  flex,
  children,
}: {
  id: string;
  flex: React.CSSProperties["flex"];
  children: React.ReactNode;
}) {
  const select = useLayout((s) => s.select);
  return (
    <div data-testid={`pane-${id}`} className="flex min-h-0 flex-col" style={{ flex }}>
      <PaneHeader id={id} onClose={() => select(id)} />
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

/**
 * Stacks the (optional) top + bottom active panes of one rail. When BOTH are
 * active a draggable horizontal divider appears (split ratio persisted). The
 * divider is keyboard-operable (Arrow keys) for a11y.
 */
export function PanelStack({
  testid,
  topId,
  botId,
  ratio,
  setRatio,
  renderContent,
}: {
  testid: string;
  topId: string | null;
  botId: string | null;
  ratio: number;
  setRatio: (r: number) => void;
  renderContent: (id: string) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLDivElement>(null);
  const both = !!topId && !!botId;

  const clamp = (r: number) => Math.max(0.2, Math.min(0.8, r));

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const el = ref.current;
    if (!el) return;
    const move = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      setRatio(clamp((ev.clientY - r.top) / r.height));
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.body.style.cursor = "row-resize";
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setRatio(clamp(ratio - 0.05));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setRatio(clamp(ratio + 0.05));
    }
  };

  return (
    <div ref={ref} data-testid={testid} className="flex h-full min-h-0 flex-col">
      {topId && (
        <Pane id={topId} flex={both ? `0 0 ${ratio * 100}%` : "1"}>
          {renderContent(topId)}
        </Pane>
      )}
      {both && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t("split.resize")}
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={20}
          aria-valuemax={80}
          tabIndex={0}
          data-testid={`${testid}-splitter`}
          onPointerDown={onPointerDown}
          onKeyDown={onKeyDown}
          className={cn(
            "group relative h-[7px] shrink-0 cursor-row-resize bg-border hover:bg-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        >
          <span className="absolute left-1/2 top-1/2 h-[3px] w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/50 group-hover:bg-primary" />
        </div>
      )}
      {botId && (
        <Pane id={botId} flex="1">
          {renderContent(botId)}
        </Pane>
      )}
    </div>
  );
}
