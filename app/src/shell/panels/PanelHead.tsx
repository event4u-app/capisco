import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/icon";

/**
 * Shared panel-head bar — 1:1 port of the prototype `.panel-head` (every left
 * tool panel renders it). Caps caption + a cluster of `.ph-act` icon buttons.
 * Styling in capisco-composer.css; the `panel-head` testid is preserved.
 */
export function PanelHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div data-testid="panel-head" className="panel-head">
      <span className="caps">{title}</span>
      {children && <div className="ph-actions">{children}</div>}
    </div>
  );
}

/** A 22px icon button for the panel head (prototype `.ph-act` / IconButton 22). */
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
      className="ph-act focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <Icon icon={icon} size={13} />
    </button>
  );
}
