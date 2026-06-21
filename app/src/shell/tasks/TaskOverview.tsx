import * as React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Layers } from "lucide-react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { mockTasksProvider } from "@/mocks/tasks";
import {
  BurndownChart,
  ChartCard,
  Donut,
  LineChart,
  MetricCard,
} from "@/components/capisco/charts";
import type { Ticket, TicketStatus } from "@/contracts";
import { LinearCard, StatusDot, TicketCard } from "./TicketCards";

type OverviewTab = "board" | "mine" | "active" | "insights";

/**
 * Tasks overview (build-spec §6, roadmap R5 Phase 1): Board (status columns ×
 * epic swimlanes), My Tickets, Active (mine in flight), and Insights (metric
 * cards + the dual Sprint/Private burndown, My-WIP line, Team-WIP bars,
 * reviews/day, throughput, work-type donut). Opening a card calls `onOpenTicket`
 * so the workspace opens it as a closable detail tab.
 */
export function TaskOverview({ onOpenTicket }: { onOpenTicket: (t: Ticket) => void }) {
  const { t } = useTranslation();
  const tasks = mockTasksProvider;
  const [tab, setTab] = React.useState<OverviewTab>("board");

  const all = tasks.getTickets();
  const cols = tasks.getColumns();
  const epics = tasks.getEpics();
  const sprint = tasks.getSprint();
  const burndown = tasks.getBurndown();
  const mine = tasks.getMyTickets();
  const active = tasks.getActiveTickets();

  const pct = Math.round((sprint.done / sprint.committed) * 100);
  const myCommitted = mine.reduce((a, x) => a + x.points, 0);
  const myDone = mine.filter((x) => x.status === "done").reduce((a, x) => a + x.points, 0);
  const myWip = all.filter((x) => x.mine && x.status === "progress").length;
  const reviewReq = all.filter((x) => x.status === "review" && !x.mine).length + 2;
  const dayLabels = tasks.getSprintDayLabels();
  const throughput = tasks.getThroughput();
  const maxTp = Math.max(...throughput, 1);

  const tabs: { id: OverviewTab; count?: number }[] = [
    { id: "board" },
    { id: "mine", count: mine.length },
    { id: "active", count: active.length },
    { id: "insights" },
  ];

  return (
    <div
      data-testid="tasks-overview"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
    >
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {t("tasks.title", { sprint: sprint.name })}
          </h2>
          <div className="text-micro text-muted-foreground tabular-nums">
            {t("tasks.sprintMeta", {
              day: sprint.day,
              days: sprint.days,
              done: sprint.done,
              committed: sprint.committed,
              pct,
            })}
          </div>
        </div>

        <div
          data-testid="tasks-tabs"
          role="tablist"
          aria-label={t("tasks.tabsLabel")}
          className="mt-4 flex flex-wrap gap-1 border-b border-border"
        >
          {tabs.map(({ id, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-testid={`tasks-tab-${id}`}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-ui transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                tab === id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`tasks.tabs.${id}`)}
              {count != null && (
                <span className="rounded-sm bg-accent px-1 text-[9px] text-muted-foreground tabular-nums">
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-4 min-h-0 flex-1" role="tabpanel">
          {tab === "board" && (
            <Board cols={cols} all={all} epics={epics} onOpenTicket={onOpenTicket} />
          )}

          {tab === "mine" && (
            <StatusColumns
              cols={cols.filter((c) => mine.some((x) => x.status === c.id))}
              tickets={mine}
              onOpenTicket={onOpenTicket}
              testid="tasks-mine"
            />
          )}

          {tab === "active" && (
            <ActiveColumns active={active} onOpenTicket={onOpenTicket} />
          )}

          {tab === "insights" && (
            <div data-testid="tasks-insights" className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <MetricCard
                  metric={{
                    label: t("tasks.insights.myWip"),
                    value: `${myWip} / ${tasks.wipLimit}`,
                    sub: t("tasks.insights.myWipSub"),
                    tier: myWip > tasks.wipLimit ? "Low" : "High",
                  }}
                />
                <MetricCard
                  metric={{
                    label: t("tasks.insights.throughput"),
                    value: "12 pts",
                    sub: t("tasks.insights.throughputSub"),
                    delta: "↑ 2",
                    good: true,
                  }}
                />
                <MetricCard
                  metric={{
                    label: t("tasks.insights.reviewsReq"),
                    value: String(reviewReq),
                    sub: t("tasks.insights.reviewsReqSub"),
                  }}
                />
                <MetricCard
                  metric={{
                    label: t("tasks.insights.cycleTime"),
                    value: "61 h",
                    sub: t("tasks.insights.cycleTimeSub"),
                    delta: "↓ 12%",
                    good: true,
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard title={t("tasks.insights.sprintBurndown")} testid="tasks-sprint-burndown-card">
                  <BurndownChart ideal={burndown.ideal} actual={burndown.team} testid="tasks-sprint-burndown" />
                  <BurndownLegend
                    remaining={sprint.committed - sprint.done}
                    total={sprint.committed}
                    accentVar="--chart-line"
                  />
                </ChartCard>
                <ChartCard title={t("tasks.insights.myBurndown")} testid="tasks-my-burndown-card">
                  <BurndownChart
                    ideal={burndown.myIdeal}
                    actual={burndown.mine}
                    accentVar="--chart-2"
                    testid="tasks-my-burndown"
                  />
                  <BurndownLegend remaining={myCommitted - myDone} total={myCommitted} accentVar="--chart-2" />
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard title={t("tasks.insights.myWipOverSprint")} testid="tasks-mywip-card">
                  <LineChart
                    data={tasks.getMyWipSeries()}
                    labels={dayLabels}
                    height={140}
                    testid="tasks-mywip-line"
                  />
                  <div className="mt-2 text-micro text-muted-foreground">
                    {t("tasks.insights.wipHint", { limit: tasks.wipLimit })}
                  </div>
                </ChartCard>
                <ChartCard title={t("tasks.insights.teamWip")} testid="tasks-teamwip-card">
                  <div data-testid="tasks-teamwip" className="flex flex-col gap-2">
                    {tasks.getTeamWip().map((w) => (
                      <div key={w.who} className="flex items-center gap-2 text-micro">
                        <span className="w-10 shrink-0 text-muted-foreground">{w.who}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              w.wip > w.limit ? "bg-destructive" : "bg-primary",
                            )}
                            style={{ width: `${Math.min(100, (w.wip / w.limit) * 100)}%` }}
                          />
                        </div>
                        <span className="w-8 shrink-0 text-right text-muted-foreground tabular-nums">
                          {w.wip}/{w.limit}
                        </span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <ChartCard title={t("tasks.insights.reviewsGiven")} testid="tasks-reviews-card">
                  <LineChart
                    data={tasks.getReviewsGiven()}
                    labels={dayLabels}
                    height={140}
                    colorVar="--chart-3"
                    testid="tasks-reviews-line"
                  />
                </ChartCard>
                <ChartCard title={t("tasks.insights.throughputChart")} testid="tasks-throughput-card">
                  <div data-testid="tasks-throughput" className="flex h-[120px] items-end gap-2">
                    {throughput.map((v, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-full w-full items-end rounded-sm bg-muted">
                          <div
                            className="w-full rounded-sm bg-primary"
                            style={{ height: `${(v / maxTp) * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground">d{i}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
                <ChartCard title={t("tasks.insights.workType")} testid="tasks-worktype-card">
                  <Donut segments={tasks.getTypeSplit()} size={130} testid="tasks-worktype-donut" />
                </ChartCard>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BurndownLegend({
  remaining,
  total,
  accentVar,
}: {
  remaining: number;
  total: number;
  accentVar: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-micro text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4 border-t border-dashed" style={{ borderColor: "hsl(var(--chart-ideal))" }} />
        {t("tasks.insights.ideal")}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0.5 w-4" style={{ background: `hsl(var(${accentVar}))` }} />
        {t("tasks.insights.remaining", { remaining, total })}
      </span>
    </div>
  );
}

function Board({
  cols,
  all,
  epics,
  onOpenTicket,
}: {
  cols: { id: TicketStatus; label: string }[];
  all: Ticket[];
  epics: { id: string; label: string }[];
  onOpenTicket: (t: Ticket) => void;
}) {
  return (
    <div data-testid="tasks-board" className="overflow-x-auto">
      <div className="min-w-[920px]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(150px, 1fr))` }}>
          {cols.map((c) => {
            const cnt = all.filter((x) => x.status === c.id).length;
            return (
              <div
                key={c.id}
                data-testid={`board-col-head-${c.id}`}
                className="flex items-center gap-1.5 px-2 py-1.5 text-micro text-muted-foreground"
              >
                <StatusDot status={c.id} />
                {c.label}
                <span className="ml-auto tabular-nums">{cnt}</span>
              </div>
            );
          })}
        </div>
        {epics.map((ep) => {
          const items = all.filter((x) => x.epic === ep.id);
          if (!items.length) return null;
          return (
            <div key={ep.id} data-testid={`board-lane-${ep.id}`} className="border-t border-border">
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-micro text-muted-foreground">
                <Icon icon={ChevronDown} size={12} />
                <Icon icon={Layers} size={12} />
                {ep.label}
                <span className="ml-auto tabular-nums">{items.length}</span>
              </div>
              <div
                className="grid gap-2 px-1 pb-3"
                style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(150px, 1fr))` }}
              >
                {cols.map((c) => (
                  <div key={c.id} className="flex flex-col gap-2">
                    {items
                      .filter((x) => x.status === c.id)
                      .map((tk) => (
                        <LinearCard key={tk.id} ticket={tk} onOpen={onOpenTicket} />
                      ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusColumns({
  cols,
  tickets,
  onOpenTicket,
  testid,
}: {
  cols: { id: TicketStatus; label: string }[];
  tickets: Ticket[];
  onOpenTicket: (t: Ticket) => void;
  testid: string;
}) {
  const { t } = useTranslation();
  return (
    <div data-testid={testid} className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cols.map((c) => {
        const items = tickets.filter((x) => x.status === c.id);
        const pts = items.reduce((a, x) => a + x.points, 0);
        return (
          <div key={c.id} className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-micro text-muted-foreground">
              <StatusDot status={c.id} />
              {c.label}
              <span className="ml-auto tabular-nums">
                {t("tasks.colMeta", { count: items.length, points: pts })}
              </span>
            </div>
            {items.map((tk) => (
              <TicketCard key={tk.id} ticket={tk} onOpen={onOpenTicket} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ActiveColumns({
  active,
  onOpenTicket,
}: {
  active: Ticket[];
  onOpenTicket: (t: Ticket) => void;
}) {
  const { t } = useTranslation();
  const statuses: TicketStatus[] = ["progress", "review", "testing"];
  return (
    <div data-testid="tasks-active" className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {statuses.map((st) => {
        const items = active.filter((x) => x.status === st);
        return (
          <div key={st} className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-micro text-muted-foreground">
              <StatusDot status={st} />
              {t(`tasks.status.${st}`)}
              <span className="ml-auto tabular-nums">{items.length}</span>
            </div>
            {items.length ? (
              items.map((tk) => <TicketCard key={tk.id} ticket={tk} onOpen={onOpenTicket} />)
            ) : (
              <div className="rounded-md border border-dashed border-border px-2 py-4 text-center text-micro text-muted-foreground">
                {t("tasks.empty")}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
