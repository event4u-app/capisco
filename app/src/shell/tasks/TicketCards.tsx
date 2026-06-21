import { GitPullRequest, CircleDashed, BarChart3 } from "lucide-react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { tasksSnapshot } from "@/mocks/tasks";
import type { Ticket } from "@/contracts";

const TYPE_TAG: Record<string, string> = { feature: "F", bug: "B", chore: "C" };

function avatar(who: string): string {
  if (who === "you") return "me";
  if (who === "—") return "·";
  return who.slice(0, 2);
}

/** Compact ticket card for the My-Tickets / Active status columns. */
export function TicketCard({ ticket: t, onOpen }: { ticket: Ticket; onOpen?: (t: Ticket) => void }) {
  return (
    <button
      type="button"
      data-testid={`ticket-card-${t.id}`}
      onClick={() => onOpen?.(t)}
      className="flex w-full flex-col gap-1.5 rounded-md border border-border bg-card p-2.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-1.5">
        <span
          className="flex size-4 items-center justify-center rounded-[3px] text-[9px] font-semibold text-primary-foreground"
          style={{ background: `hsl(var(${tasksSnapshot.typeChartVar(t.type)}))` }}
        >
          {TYPE_TAG[t.type] ?? "F"}
        </span>
        <span className="text-micro text-muted-foreground">{t.id}</span>
        {t.mine && (
          <span className="rounded-sm border border-primary px-1 text-[9px] uppercase text-primary">
            mine
          </span>
        )}
        <span className="ml-auto text-micro text-muted-foreground tabular-nums">{t.points}</span>
      </div>
      <div className="text-ui text-foreground">{t.title}</div>
      <div className="flex items-center gap-1.5 text-micro text-muted-foreground">
        <span className="flex size-4 items-center justify-center rounded-full bg-accent text-[9px]">
          {avatar(t.who)}
        </span>
        {t.who}
      </div>
    </button>
  );
}

/** Linear-style board card: id + avatar, title, type/mine labels, footer. */
export function LinearCard({ ticket: t, onOpen }: { ticket: Ticket; onOpen?: (t: Ticket) => void }) {
  const typeVar = tasksSnapshot.typeChartVar(t.type);
  return (
    <button
      type="button"
      data-testid={`board-card-${t.id}`}
      onClick={() => onOpen?.(t)}
      className="flex w-full flex-col gap-1.5 rounded-md border border-border bg-card p-2 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between">
        <span className="text-micro text-muted-foreground">{t.id}</span>
        <span
          title={t.who}
          className="flex size-4 items-center justify-center rounded-full bg-accent text-[9px] text-muted-foreground"
        >
          {avatar(t.who)}
        </span>
      </div>
      <div className="text-ui text-foreground">{t.title}</div>
      <div className="flex flex-wrap items-center gap-1">
        <Icon icon={BarChart3} size={11} className="text-muted-foreground" />
        <span
          className="rounded-sm border px-1 text-[9px]"
          style={{ color: `hsl(var(${typeVar}))`, borderColor: `hsl(var(${typeVar}))` }}
        >
          {t.type}
        </span>
        {t.mine && (
          <span className="rounded-sm border border-primary px-1 text-[9px] text-primary">mine</span>
        )}
      </div>
      {(t.branch || t.sub) && (
        <div className="flex items-center gap-2 text-micro text-muted-foreground">
          {t.branch && (
            <span className="inline-flex items-center gap-0.5">
              <Icon icon={GitPullRequest} size={11} />
              {t.branch}
            </span>
          )}
          {t.sub && (
            <span className="inline-flex items-center gap-0.5">
              <Icon icon={CircleDashed} size={11} />
              {t.sub}
            </span>
          )}
          <span className="ml-auto tabular-nums">{t.points}</span>
        </div>
      )}
    </button>
  );
}

/** Status dot used in column / lane headers. Color from the chart palette. */
export function StatusDot({ status, className }: { status: string; className?: string }) {
  const colorMap: Record<string, string> = {
    backlog: "--chart-6",
    todo: "--chart-4",
    progress: "--chart-3",
    review: "--chart-2",
    testing: "--chart-1",
    done: "--chart-5",
  };
  return (
    <span
      data-testid={`status-dot-${status}`}
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: `hsl(var(${colorMap[status] ?? "--chart-6"}))` }}
    />
  );
}
