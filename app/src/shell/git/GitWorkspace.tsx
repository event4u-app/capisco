import * as React from "react";
import { useTranslation } from "react-i18next";
import { GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { gitSnapshot } from "@/mocks/git";
import { useLayout } from "@/shell/store";
import { usePalette } from "@/shell/command-registry";
import { ChartCard, Donut, Heatmap, LineChart, MetricCard } from "@/components/capisco/charts";
import { PrList } from "./PrItem";
import { TeamTab } from "./TeamTab";
import { RangeFilter, type RangeValue } from "./RangeFilter";

type GitTab = "mine" | "review" | "overdue" | "team" | "overview" | "activity" | "working";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Git Dashboard center workspace (build-spec §5, roadmap R5 Phase 0). Seven
 * tabs (My PRs / Review Requested / Overdue / Team / Overview / Activity /
 * Working Times) under a shared Git-Dashboard header + date-range filter. PR
 * lists, DORA cards, inline-SVG charts, and the 7×24 working-times heatmap all
 * compose the chart primitives. The Overdue threshold is 7 days (build-plan §3
 * correction) and configurable via the in-tab selector.
 */
export function GitWorkspace() {
  const { t } = useTranslation();
  const git = gitSnapshot;
  const setMode = useLayout((s) => s.setMode);
  const register = usePalette((s) => s.register);

  // Self-register the Git-Dashboard action in the palette (escalation ladder).
  React.useEffect(() => {
    return register({
      id: "git:open",
      group: "view",
      icon: GitBranch,
      label: t("git.command.open"),
      run: () => setMode("git"),
    });
  }, [register, t, setMode]);

  const [tab, setTab] = React.useState<GitTab>("mine");
  const [range, setRange] = React.useState<RangeValue>("week");
  const [from, setFrom] = React.useState("2026-03-24");
  const [to, setTo] = React.useState("2026-06-16");
  const [coreStart, setCoreStart] = React.useState(9);
  const [coreEnd, setCoreEnd] = React.useState(17);
  const [overdueThreshold, setOverdueThreshold] = React.useState(git.overdueThresholdDays);

  const mine = git.getMyPullRequests();
  const review = git.getReviewRequested();
  const overdue = git.getOverdue(overdueThreshold);
  const awarenessCount = git.getAwareness().length;
  const weeks = git.getWeeks();
  const series = git.getSeries();
  const activity = git.getActivityStats();
  const maxPerDay = Math.max(...activity.perDay);

  const tabs: { id: GitTab; count?: number }[] = [
    { id: "mine", count: mine.length },
    { id: "review", count: review.length },
    { id: "overdue", count: overdue.length },
    { id: "team", count: awarenessCount },
    { id: "overview" },
    { id: "activity" },
    { id: "working" },
  ];

  return (
    <div
      data-testid="git-workspace"
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-[1100px] flex-1 flex-col overflow-y-auto px-6 py-5">
        {/* Header + filter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{t("git.title")}</h2>
          <RangeFilter
            value={range}
            onChange={setRange}
            from={from}
            to={to}
            onFrom={setFrom}
            onTo={setTo}
          />
        </div>

        {/* Tabs (prototype .gitw-tabs / .gitw-tab / .gitw-tcount). */}
        <div
          data-testid="git-tabs"
          role="tablist"
          aria-label={t("git.tabsLabel")}
          className="gitw-tabs mt-4"
        >
          {tabs.map(({ id, count }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-testid={`git-tab-${id}`}
              onClick={() => setTab(id)}
              className={cn("gitw-tab", tab === id && "active")}
            >
              {t(`git.tabs.${id}`)}
              {count != null && <span className="gitw-tcount tabular-nums">{count}</span>}
            </button>
          ))}
        </div>

        {/* Tab bodies */}
        <div className="mt-4 min-h-0 flex-1" role="tabpanel">
          {tab === "mine" && (
            <PrList
              list={mine}
              overdueThreshold={overdueThreshold}
              emptyKey="git.empty.mine"
              testid="git-list-mine"
            />
          )}

          {tab === "review" && (
            <PrList
              list={review}
              highlightReReview
              overdueThreshold={overdueThreshold}
              emptyKey="git.empty.review"
              testid="git-list-review"
            />
          )}

          {tab === "overdue" && (
            <>
              <div
                data-testid="git-overdue-controls"
                className="mb-3 flex flex-wrap items-center gap-2 text-micro text-muted-foreground"
              >
                <span>{t("git.overdue.threshold")}</span>
                <select
                  data-testid="git-overdue-threshold"
                  value={overdueThreshold}
                  onChange={(e) => setOverdueThreshold(Number(e.target.value))}
                  className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-micro text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {[3, 5, 7, 10, 14].map((d) => (
                    <option key={d} value={d}>
                      {t("git.overdue.days", { count: d })}
                    </option>
                  ))}
                </select>
                <span>· {t("git.overdue.note")}</span>
              </div>
              <PrList
                list={overdue}
                overdue
                overdueThreshold={overdueThreshold}
                emptyKey="git.empty.overdue"
                testid="git-list-overdue"
              />
            </>
          )}

          {tab === "team" && <TeamTab />}

          {tab === "overview" && (
            <div className="flex flex-col gap-4">
              <div data-testid="git-dora" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {git.getDora().map((m) => (
                  <MetricCard key={m.label} metric={m} />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard title={t("git.overview.cycleTime")} testid="git-cycle-card">
                  <LineChart
                    data={series.cycleTime}
                    labels={weeks}
                    height={170}
                    testid="git-cycle-line"
                  />
                </ChartCard>
                <ChartCard title={t("git.overview.prCategories")} testid="git-categories-card">
                  <Donut segments={git.getPrCategories()} testid="git-categories-donut" />
                </ChartCard>
              </div>
            </div>
          )}

          {tab === "activity" && (
            <div className="flex flex-col gap-4">
              <div data-testid="git-activity-stats" className="gd-stats">
                <div className="gd-stat">
                  <div className="gd-val tabular-nums">{activity.commits}</div>
                  <div className="gd-lab">{t("git.activity.commits")}</div>
                </div>
                <div className="gd-stat">
                  <div className="gd-val tabular-nums">
                    {activity.prsOpened} / {activity.prsMerged}
                  </div>
                  <div className="gd-lab">{t("git.activity.prs")}</div>
                </div>
                <div className="gd-stat">
                  <div className="gd-val tabular-nums">
                    <span className="gd-add">+{activity.added.toLocaleString()}</span>{" "}
                    <span className="gd-del">−{activity.removed.toLocaleString()}</span>
                  </div>
                  <div className="gd-lab">{t("git.activity.lines")}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard
                  title={t("git.activity.commitsPerWeek")}
                  testid="git-act-commits-card"
                >
                  <LineChart
                    data={series.commits}
                    labels={weeks}
                    height={150}
                    testid="git-act-commits"
                  />
                </ChartCard>
                <ChartCard title={t("git.activity.prsPerWeek")} testid="git-act-prs-card">
                  <LineChart
                    data={series.prsMerged}
                    labels={weeks}
                    height={150}
                    testid="git-act-prs"
                  />
                </ChartCard>
                <ChartCard title={t("git.activity.locPerWeek")} testid="git-act-loc-card">
                  <LineChart
                    data={series.loc}
                    labels={weeks}
                    height={150}
                    fmt={(v) => `${v}k`}
                    testid="git-act-loc"
                  />
                </ChartCard>
                <ChartCard
                  title={t("git.activity.reviewsPerWeek")}
                  testid="git-act-reviews-card"
                >
                  <LineChart
                    data={series.reviews}
                    labels={weeks}
                    height={150}
                    testid="git-act-reviews"
                  />
                </ChartCard>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard title={t("git.activity.languages")} testid="git-langs-card">
                  <div data-testid="git-langs" className="flex flex-col gap-2">
                    {git.getLanguages().map((l) => (
                      <div key={l.name} data-testid={`git-lang-${l.name}`}>
                        <div className="flex items-center justify-between text-micro">
                          <span className="text-foreground">{l.name}</span>
                          <span className="text-muted-foreground tabular-nums">{l.pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${l.pct}%`,
                              background: `hsl(var(${l.chartVar}))`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartCard>
                <ChartCard title={t("git.activity.commitsPerDay")} testid="git-perday-card">
                  <div data-testid="git-perday" className="flex h-[120px] items-end gap-2">
                    {activity.perDay.map((v, i) => (
                      <div key={i} className="flex flex-1 flex-col items-center gap-1">
                        <div className="flex h-full w-full items-end rounded-sm bg-muted">
                          <div
                            className="w-full rounded-sm bg-primary"
                            style={{ height: `${(v / maxPerDay) * 100}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground">
                          {activity.dayLabels[i]}
                        </span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>
            </div>
          )}

          {tab === "working" && (
            <div className="flex flex-col gap-4">
              <div
                data-testid="git-working-controls"
                className="flex flex-wrap items-center gap-2 text-micro text-muted-foreground"
              >
                <span>{t("git.working.hours")}</span>
                <select
                  data-testid="git-core-start"
                  value={coreStart}
                  onChange={(e) => setCoreStart(Number(e.target.value))}
                  className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-micro text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {pad(h)}:00
                    </option>
                  ))}
                </select>
                <span>–</span>
                <select
                  data-testid="git-core-end"
                  value={coreEnd}
                  onChange={(e) => setCoreEnd(Number(e.target.value))}
                  className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-micro text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      {pad(h)}:00
                    </option>
                  ))}
                </select>
                <span>{t("git.working.outsideHint")}</span>
              </div>
              <ChartCard title={t("git.working.heatmap")} testid="git-heatmap-card">
                <div className="mb-2 text-micro text-muted-foreground">
                  {t("git.working.sub")}
                </div>
                <Heatmap
                  grid={git.getWorkHeatmap()}
                  coreStart={coreStart}
                  coreEnd={coreEnd}
                  testid="git-heatmap"
                />
                <div className="mt-2 flex flex-wrap gap-4 text-micro text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-[2px]"
                      style={{ background: "hsl(var(--chart-good))" }}
                    />
                    {t("git.working.core", {
                      start: `${pad(coreStart)}:00`,
                      end: `${pad(coreEnd)}:00`,
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2.5 rounded-[2px]"
                      style={{ background: "hsl(var(--chart-bad))" }}
                    />
                    {t("git.working.off")}
                  </span>
                </div>
              </ChartCard>
            </div>
          )}
        </div>

        {/* Honest-limits note (Invariant §2.3 / build-spec §6) — always visible. */}
        <div
          data-testid="git-honest-note"
          className="mt-6 border-t border-border pt-3 text-micro text-muted-foreground"
        >
          {t("git.honest")}
        </div>
      </div>
    </div>
  );
}
