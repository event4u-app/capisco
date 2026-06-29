import * as React from "react";
import { useTranslation } from "react-i18next";
import { Bell, BellRing, Bug, ChevronLeft, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { sentrySnapshot } from "@/mocks/sentry";
import { useLayout } from "@/shell/store";
import { usePalette } from "@/shell/command-registry";
import { LineChart, Sparkline } from "@/components/capisco/charts";
import { sanitizeCulprit, sanitizeIssueTitle, sanitizeTag } from "@/lib/sentry-sanitize";
import type { SentryIssue, SentryLevel } from "@/contracts";

type SentryTab = "issues" | "crons" | "perf" | "alerts";

/** Level → design-system color (spec §9: error→error, warning→warning, info→accent/teal). */
const LEVEL_COLOR: Record<SentryLevel, string> = {
  error: "var(--ds-error)",
  warning: "var(--ds-warning)",
  info: "var(--ds-accent)",
};

/** Performance charts — design literal series (prototype views.jsx §perf), deterministic. */
const PERF_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Sentry center workspace — 1:1 port of the prototype `SentryWorkspace`
 * (road-to-sentry-observability P0). Four tabs (Issues / Cron Monitors /
 * Performance / Alerts) backed by the deterministic fixture snapshot. Every
 * untrusted Sentry string (title, culprit, tags, assignee) passes through the
 * G-SENTRY-SANITIZE sanitizer before render. Teal-only accent; level colors
 * error/warning/accent (spec §9). Writes (resolve/ignore/assign/toggle) are
 * disabled here — they flow through the broker in P2.
 */
export function SentryWorkspace() {
  const { t } = useTranslation();
  const setMode = useLayout((s) => s.setMode);
  const register = usePalette((s) => s.register);

  React.useEffect(() => {
    return register({
      id: "sentry:open",
      group: "view",
      icon: Bug,
      label: t("sentry.command.open"),
      run: () => setMode("sentry"),
    });
  }, [register, t, setMode]);

  const [tab, setTab] = React.useState<SentryTab>("issues");
  const [env, setEnv] = React.useState("production");
  const [q, setQ] = React.useState("is:unresolved");
  const [detailId, setDetailId] = React.useState<string | null>(null);

  const stats = sentrySnapshot.getStats();
  const allIssues = sentrySnapshot.getAllIssues();
  const crons = sentrySnapshot.getCrons();
  const alerts = sentrySnapshot.getAlertRules();

  // Filter mirrors the prototype exactly.
  const issues = allIssues.filter(
    (i) =>
      (env === "all" || i.env === env) &&
      (q.indexOf("is:unresolved") < 0 || i.status === "unresolved"),
  );

  const activeIssue = detailId ? allIssues.find((i) => i.id === detailId) : undefined;

  const goTab = (id: SentryTab) => {
    setTab(id);
    setDetailId(null);
  };

  const tabs: [SentryTab, string, number | null][] = [
    ["issues", t("sentry.tabs.issues"), issues.length],
    ["crons", t("sentry.tabs.crons"), crons.length],
    ["perf", t("sentry.tabs.performance"), null],
    ["alerts", t("sentry.tabs.alerts"), alerts.filter((a) => a.on).length],
  ];

  const crumbTab = detailId ? (activeIssue?.id ?? tab) : tab;

  return (
    <div data-testid="sentry-workspace" className="git-workspace">
      <div className="gitw-inner">
        <div className="gitw-head">
          <h2 className="gitw-title">{t("sentry.title")}</h2>
          <div className="sentry-stats" data-testid="sentry-stats">
            <span className="sst">
              <b style={{ color: "var(--ds-error)" }}>{stats.errors24h}</b>{" "}
              {t("sentry.stats.errors24h")} <i>{sanitizeTag(stats.errorsTrend)}</i>
            </span>
            <span className="sst">
              <b>{sanitizeTag(stats.crashFree)}</b> {t("sentry.stats.crashFree")}
            </span>
            <span className="sst">
              <b
                style={{ color: stats.failingCrons ? "var(--ds-error)" : "var(--ds-success)" }}
              >
                {stats.failingCrons}
              </b>{" "}
              {t("sentry.stats.cronsFailing")}
            </span>
            <span className="sst">
              <b>{sanitizeTag(stats.p95)}</b> {t("sentry.stats.p95")}
            </span>
          </div>
        </div>

        <div
          className="mb-3 font-mono text-micro lowercase text-muted-foreground"
          data-testid="sentry-crumb"
        >
          sentry › {crumbTab} · {env}
        </div>

        <div className="gitw-tabs" role="tablist" aria-label={t("sentry.title")}>
          {tabs.map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              data-testid={`sentry-tab-${id}`}
              className={cn("gitw-tab", tab === id && "active")}
              onClick={() => goTab(id)}
            >
              {label}
              {count != null && <span className="gitw-tcount tabular-nums">{count}</span>}
            </button>
          ))}
        </div>

        {tab === "issues" &&
          (activeIssue ? (
            <IssueDetail issue={activeIssue} onBack={() => setDetailId(null)} />
          ) : (
            <>
              <div className="sentry-filter">
                <select
                  className="ch-sel sentry-sel"
                  value={env}
                  data-testid="sentry-env"
                  onChange={(e) => setEnv(e.target.value)}
                >
                  <option value="all">{t("sentry.filter.allEnvironments")}</option>
                  <option value="production">{t("sentry.filter.production")}</option>
                  <option value="staging">{t("sentry.filter.staging")}</option>
                </select>
                <div className="sentry-search">
                  <Search size={13} color="var(--ds-text-tertiary)" />
                  <input
                    value={q}
                    data-testid="sentry-query"
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={t("sentry.filter.searchPlaceholder")}
                  />
                </div>
              </div>
              <div className="sentry-issues" data-testid="sentry-issues">
                <div className="si-head">
                  <span className="si-c-title">{t("sentry.issuesHead.issue")}</span>
                  <span className="si-c-graph">{t("sentry.issuesHead.trend")}</span>
                  <span className="si-c-num">{t("sentry.issuesHead.events")}</span>
                  <span className="si-c-num">{t("sentry.issuesHead.users")}</span>
                  <span className="si-c-age">{t("sentry.issuesHead.age")}</span>
                  <span className="si-c-seen">{t("sentry.issuesHead.lastSeen")}</span>
                </div>
                {issues.map((i) => {
                  const assignee = i.assignee ? sanitizeTag(i.assignee) : "";
                  return (
                    <div
                      className="si-row"
                      key={i.id}
                      role="button"
                      tabIndex={0}
                      data-testid={`sentry-issue-${i.id}`}
                      onClick={() => setDetailId(i.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailId(i.id);
                        }
                      }}
                    >
                      <span className="si-bar" style={{ background: LEVEL_COLOR[i.level] }} />
                      <div className="si-title">
                        <div className="si-name">{sanitizeIssueTitle(i.title)}</div>
                        <div className="si-culprit">{sanitizeCulprit(i.culprit)}</div>
                        <div className="si-tags">
                          <span className="si-proj">{sanitizeTag(i.project)}</span>
                          <span className={`si-env env-${i.env}`}>{sanitizeTag(i.env)}</span>
                          <span className={`si-status sst-${i.status}`}>
                            {sanitizeTag(i.status)}
                          </span>
                        </div>
                      </div>
                      <span className="si-graph">
                        <Sparkline data={i.trend} color={LEVEL_COLOR[i.level]} />
                      </span>
                      <span className="si-num tabular-nums">{i.events}</span>
                      <span className="si-num tabular-nums">{i.users}</span>
                      <span className="si-age">{sanitizeTag(i.age)}</span>
                      <span className="si-seen">
                        {sanitizeTag(i.lastSeen)}
                        {assignee && (
                          <span className="si-assignee" title={assignee}>
                            {assignee.slice(0, 2)}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ))}

        {tab === "crons" && (
          <div className="sentry-crons" data-testid="sentry-crons">
            <div className="sc-head">
              <span>{t("sentry.crons.monitor")}</span>
              <span>{t("sentry.crons.status")}</span>
              <span className="sc-c-checks">{t("sentry.crons.checkins")}</span>
              <span>{t("sentry.crons.alerts")}</span>
            </div>
            {crons.map((c) => (
              <div className="sc-row" key={c.name} data-testid={`sentry-cron-${c.name}`}>
                <div className="sc-name">
                  <span className="sc-mon">{sanitizeTag(c.name)}</span>
                  <span className="sc-sched">
                    {sanitizeTag(c.project)} · {sanitizeIssueTitle(c.schedule)}
                  </span>
                </div>
                <span className={`sc-status scs-${c.status}`}>
                  {c.status === "ok" ? t("sentry.crons.healthy") : sanitizeTag(c.status)}
                </span>
                <span className="sc-checks">
                  {c.ticks.split("").map((tk, j) => (
                    <span
                      key={j}
                      className={cn("sc-tick", tk === "s" ? "ok" : tk === "t" ? "to" : "fail")}
                    />
                  ))}
                </span>
                <span className="sc-alerts">
                  <Bell size={11} color="var(--ds-text-tertiary)" />
                  {c.alerts}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "perf" && (
          <div className="gitw-cols" data-testid="sentry-perf">
            <div className="cc">
              <div className="cc-head">
                <span className="cc-title">{t("sentry.perf.p95")}</span>
              </div>
              <div className="cc-body">
                <LineChart
                  data={[620, 710, 680, 842, 790, 910, 842]}
                  labels={PERF_LABELS}
                  color="var(--ds-warning)"
                  height={150}
                  fmt={(v) => `${v}ms`}
                  testid="sentry-perf-p95"
                />
              </div>
            </div>
            <div className="cc">
              <div className="cc-head">
                <span className="cc-title">{t("sentry.perf.apdex")}</span>
              </div>
              <div className="cc-body">
                <LineChart
                  data={[0.91, 0.93, 0.9, 0.94, 0.92, 0.95, 0.94].map((v) => v * 100)}
                  labels={PERF_LABELS}
                  color="var(--ds-accent)"
                  height={150}
                  fmt={(v) => (v / 100).toFixed(2)}
                  testid="sentry-perf-apdex"
                />
              </div>
            </div>
            <div className="cc">
              <div className="cc-head">
                <span className="cc-title">{t("sentry.perf.throughput")}</span>
              </div>
              <div className="cc-body">
                <LineChart
                  data={[820, 910, 880, 1020, 960, 1080, 990]}
                  labels={PERF_LABELS}
                  color="var(--ds-syn-control)"
                  height={150}
                  testid="sentry-perf-throughput"
                />
              </div>
            </div>
            <div className="cc">
              <div className="cc-head">
                <span className="cc-title">{t("sentry.perf.crashFree")}</span>
              </div>
              <div className="cc-body">
                <LineChart
                  data={[99.9, 99.8, 99.85, 99.7, 99.82, 99.9, 99.82]}
                  labels={PERF_LABELS}
                  color="var(--ds-success)"
                  height={150}
                  fmt={(v) => `${v}%`}
                  testid="sentry-perf-crashfree"
                />
              </div>
            </div>
          </div>
        )}

        {tab === "alerts" && (
          <>
            <div className="sentry-alerthint">
              <BellRing size={13} color="var(--ds-accent)" />
              {t("sentry.alerts.hint")}
            </div>
            <div className="sentry-alerts" data-testid="sentry-alerts">
              {alerts.map((a, i) => (
                <div className="sa-row" key={i} data-testid={`sentry-alert-${i}`}>
                  <span className="sa-dot" style={{ background: LEVEL_COLOR[a.level] }} />
                  <div className="sa-main">
                    <div className="sa-name">{sanitizeIssueTitle(a.name)}</div>
                    <div className="sa-cond">
                      {sanitizeIssueTitle(a.cond)} · {sanitizeTag(a.channel)}
                    </div>
                  </div>
                  <span className={cn("sa-toggle", a.on && "on")}>
                    <span className="sa-knob" />
                  </span>
                </div>
              ))}
              <button type="button" className="sa-add">
                <Plus size={14} />
                {t("sentry.alerts.newRule")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Issue detail (roadmap P0 — composed on-brand; the prototype has no detail
 * spec). Sanitized title/culprit/tags, event/user metrics, action buttons that
 * are visible-but-disabled (writes land in P2 via the broker). The fixture
 * carries no stacktrace; that arrives with the real provider (P1).
 */
function IssueDetail({ issue, onBack }: { issue: SentryIssue; onBack: () => void }) {
  const { t } = useTranslation();
  const actions = ["resolve", "ignore", "assign", "openInSentry"] as const;
  return (
    <div className="sentry-detail" data-testid="sentry-detail">
      <div className="sd-head">
        <button
          type="button"
          className="sd-back"
          onClick={onBack}
          data-testid="sentry-detail-back"
        >
          <ChevronLeft size={14} />
          {t("sentry.detail.back")}
        </button>
        <div className="sd-title">
          <h3>
            <span style={{ color: LEVEL_COLOR[issue.level] }}>● </span>
            {sanitizeIssueTitle(issue.title)}
          </h3>
          <div className="sd-culprit">{sanitizeCulprit(issue.culprit)}</div>
        </div>
      </div>

      <div className="sd-actions">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            className="sd-act"
            disabled
            title={t("sentry.detail.actionsNote")}
            data-testid={`sentry-detail-${a}`}
          >
            {t(`sentry.detail.actions.${a}`)}
          </button>
        ))}
      </div>

      <div className="sd-meta">
        <div className="sd-metric">
          <div className="sd-mk">{t("sentry.detail.events")}</div>
          <div className="sd-mv tabular-nums">{issue.events}</div>
        </div>
        <div className="sd-metric">
          <div className="sd-mk">{t("sentry.detail.users")}</div>
          <div className="sd-mv tabular-nums">{issue.users}</div>
        </div>
        <div className="sd-metric">
          <div className="sd-mk">{t("sentry.detail.age")}</div>
          <div className="sd-mv">{sanitizeTag(issue.age)}</div>
        </div>
        <div className="sd-metric">
          <div className="sd-mk">{t("sentry.detail.lastSeen")}</div>
          <div className="sd-mv">{sanitizeTag(issue.lastSeen)}</div>
        </div>
      </div>

      <div className="sd-section">
        <div className="si-tags" style={{ marginBottom: 8 }}>
          <span className="si-proj">{sanitizeTag(issue.project)}</span>
          <span className={`si-env env-${issue.env}`}>{sanitizeTag(issue.env)}</span>
          <span className={`si-status sst-${issue.status}`}>{sanitizeTag(issue.status)}</span>
        </div>
        <div className="sd-note">{t("sentry.detail.noStacktrace")}</div>
      </div>
    </div>
  );
}
