import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/icon";

/** Shared panel-head bar (build-spec §3 panel-head) — uppercase caption + a
 * cluster of small icon-button actions, matching the prototype's `.panel-head`. */
export function PanelHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div
      data-testid="panel-head"
      className="flex h-7 shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 text-micro font-medium uppercase tracking-wide text-muted-foreground"
    >
      <span className="truncate">{title}</span>
      {children && <div className="ml-auto flex items-center gap-0.5">{children}</div>}
    </div>
  );
}

/** A 22px icon button for the panel head. */
export function PanelHeadAction({
  icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-[22px] items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <Icon icon={icon} size={13} />
    </button>
  );
}
