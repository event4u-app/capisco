import { GitPullRequest, CircleDashed, BarChart3 } from "lucide-react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/contracts";

const TYPE_TAG: Record<string, string> = { feature: "F", bug: "B", chore: "C" };
const TYPE_COLOR: Record<string, string> = {
  feature: "var(--ds-accent)",
  bug: "var(--ds-error)",
  chore: "var(--ds-text-tertiary)",
};

function avatar(who: string): string {
  if (who === "you") return "me";
  if (who === "—") return "·";
  return who.slice(0, 2);
}

/**
 * Compact ticket card — 1:1 port of the prototype `TicketCard` (views.jsx):
 * `.tkt` with a `.tkt-top` row (`.task-type tt-*` tag, `.tkt-id`, `.tkt-mine`,
 * `.tkt-pts`), a `.tkt-title`, and a `.tkt-who` rail (`.tkt-av` + name). Rendered
 * as a `<button>` for keyboard a11y; classes + testids preserved.
 */
export function TicketCard({
  ticket: t,
  onOpen,
}: {
  ticket: Ticket;
  onOpen?: (t: Ticket) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`ticket-card-${t.id}`}
      onClick={() => onOpen?.(t)}
      className="tkt w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="tkt-top">
        <span className={cn("task-type", `tt-${t.type}`)}>{TYPE_TAG[t.type] ?? "F"}</span>
        <span className="tkt-id">{t.id}</span>
        {t.mine && <span className="tkt-mine">mine</span>}
        <span className="tkt-pts tabular-nums">{t.points}</span>
      </div>
      <div className="tkt-title">{t.title}</div>
      <div className="tkt-who">
        <span className="tkt-av">{avatar(t.who)}</span>
        {t.who}
      </div>
    </button>
  );
}

/**
 * Linear-style board card — 1:1 port of the prototype `LinearCard` (views.jsx):
 * `.lc-card` with `.lc-top` (id + avatar), `.lc-title`, `.lc-labels` (priority
 * icon + type + mine), and an optional `.lc-foot` (PR / subtasks / points).
 */
export function LinearCard({
  ticket: t,
  onOpen,
}: {
  ticket: Ticket;
  onOpen?: (t: Ticket) => void;
}) {
  const typeColor = TYPE_COLOR[t.type] ?? "var(--ds-text-tertiary)";
  return (
    <button
      type="button"
      data-testid={`board-card-${t.id}`}
      onClick={() => onOpen?.(t)}
      className="lc-card w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="lc-top">
        <span className="lc-id">{t.id}</span>
        <span className="lc-av" title={t.who}>
          {avatar(t.who)}
        </span>
      </div>
      <div className="lc-title">{t.title}</div>
      <div className="lc-labels">
        <span className="lc-pri">
          <Icon icon={BarChart3} size={11} className="text-muted-foreground" />
        </span>
        <span className="lc-label" style={{ color: typeColor, borderColor: typeColor }}>
          {t.type}
        </span>
        {t.mine && <span className="lc-label lc-mine">mine</span>}
      </div>
      {(t.branch || t.sub) && (
        <div className="lc-foot">
          {t.branch && (
            <span className="lc-pr">
              <Icon icon={GitPullRequest} size={11} />
              {t.branch}
            </span>
          )}
          {t.sub && (
            <span className="lc-sub">
              <Icon icon={CircleDashed} size={11} />
              {t.sub}
            </span>
          )}
          <span className="lc-pts tabular-nums">{t.points}</span>
        </div>
      )}
    </button>
  );
}

/**
 * Status dot used in column / lane headers — prototype `.tk-actdot st-*`
 * (per-status colour from the ds palette).
 */
export function StatusDot({ status, className }: { status: string; className?: string }) {
  return (
    <span
      data-testid={`status-dot-${status}`}
      className={cn("tk-actdot", `st-${status}`, className)}
    />
  );
}
