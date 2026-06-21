import type {
  ActivityStats,
  AwarenessEntry,
  DonutSegment,
  GitProvider,
  LangStat,
  Metric,
  PullRequest,
  WeeklySeries,
  WorkHeatmap,
} from "@/contracts";

/**
 * Deterministic Git-Dashboard provider (build-spec §5, prototype shared.jsx
 * GIT_*). Implements the R0 data-shape interfaces; no Date.now / Math.random.
 * Colours are referenced as chart-palette var NAMES (e.g. "--chart-1"), never
 * hardcoded hex — the chart primitives resolve them via hsl(var(...)).
 */

/** Overdue threshold default (build-plan §3 correction): 7 days, not 3. */
const OVERDUE_THRESHOLD_DAYS = 7;

const PULL_REQUESTS: PullRequest[] = [
  { num: 1284, title: "Worktree teardown frees its allocated port", repo: "capisco-core", branch: "feat/worktree-teardown", author: "you", draft: false, days: 1, checks: "passing", comments: 4, add: 128, del: 47, labels: ["feature", "core"], reviews: [{ who: "mara", state: "approved" }, { who: "kai", state: "pending" }] },
  { num: 1280, title: "Session resume from store", repo: "capisco-core", branch: "feat/session-resume", author: "you", draft: false, days: 5, checks: "failing", comments: 9, add: 540, del: 120, labels: ["feature"], reviews: [{ who: "mara", state: "changes" }] },
  { num: 1276, title: "Port allocator avoids TOCTOU", repo: "capisco-tauri", branch: "fix/port-allocator", author: "you", draft: true, days: 2, checks: "pending", comments: 1, add: 64, del: 18, labels: ["bug"], reviews: [] },
  { num: 1271, title: "CI: cache pnpm store between runs", repo: "capisco-core", branch: "chore/ci-cache", author: "you", draft: false, days: 8, checks: "passing", comments: 0, add: 60, del: 12, labels: ["chore"], reviews: [] },
  { num: 1283, title: "Capability scope cache", repo: "capisco-core", branch: "feat/capability-cache", author: "mara", draft: false, days: 0, checks: "passing", comments: 2, add: 210, del: 30, labels: ["feature"], reviews: [{ who: "you", state: "pending" }], requested: true },
  { num: 1279, title: "Broker grant model perf pass", repo: "capisco-tauri", branch: "perf/broker-grant", author: "jdev", draft: false, days: 9, checks: "passing", comments: 6, add: 96, del: 140, labels: ["perf"], reviews: [{ who: "you", state: "pending" }, { who: "mara", state: "approved" }], reviewedByMe: true },
  { num: 1268, title: "Docs: capability broker overview", repo: "capisco-core", branch: "docs/broker", author: "sam", draft: false, days: 2, checks: "passing", comments: 1, add: 80, del: 4, labels: ["docs"], reviews: [{ who: "you", state: "pending" }], requested: true },
  { num: 1255, title: "Refactor session store internals", repo: "capisco-core", branch: "refactor/session-store", author: "lea", draft: false, days: 12, checks: "passing", comments: 14, add: 820, del: 610, labels: ["refactor"], reviews: [{ who: "mara", state: "approved" }] },
];

const WEEKS = ["23 Mar", "30 Mar", "06 Apr", "13 Apr", "20 Apr", "27 Apr", "04 May", "11 May", "18 May", "25 May", "01 Jun", "08 Jun", "15 Jun"];

const SERIES: WeeklySeries = {
  commits: [102, 64, 196, 455, 470, 432, 590, 695, 448, 675, 712, 540, 210],
  prsMerged: [45, 26, 9, 27, 20, 8, 62, 89, 51, 120, 157, 158, 47],
  loc: [370, 118, 12, 205, 135, 128, 165, 200, 970, 1040, 225, 375, 90],
  reviews: [8, 2, 0, 0, 2, 1, 6, 3, 9, 1, 11, 3, 0],
  cycleTime: [186, 57, 54, 68, 55, 156, 162, 42, 79, 40, 8, 13, 31],
};

const DORA: Metric[] = [
  { label: "Lead Time for Changes", value: "61.4 h", tier: "High", delta: "↓74.1%", good: true, sub: "Avg. time from first commit to merge" },
  { label: "Deployment Frequency", value: "74.5 / wk", tier: "Elite", delta: "↑410.3%", good: true, sub: "PRs merged per week (proxy)" },
  { label: "Change Failure Rate", value: "3 %", tier: "Elite", delta: "↓41.2%", good: true, sub: "Merged with failed CI checks" },
];

const PR_CATEGORIES: DonutSegment[] = [
  { label: "Planned", value: 64, chartVar: "--chart-1" },
  { label: "Unplanned", value: 36, chartVar: "--chart-3" },
];

const LANGS: LangStat[] = [
  { name: "TypeScript", pct: 62, chartVar: "--chart-1" },
  { name: "Rust", pct: 21, chartVar: "--chart-3" },
  { name: "CSS", pct: 11, chartVar: "--chart-2" },
  { name: "Markdown", pct: 6, chartVar: "--chart-6" },
];

const ACTIVITY: ActivityStats = {
  commits: 47,
  prsOpened: 6,
  prsMerged: 4,
  added: 3128,
  removed: 1407,
  perDay: [3, 7, 5, 9, 12, 6, 8],
  dayLabels: ["M", "T", "W", "T", "F", "S", "S"],
};

/** Label → chart-palette var for PR / ticket type labels. */
const LABEL_CHART_VARS: Record<string, string> = {
  feature: "--chart-1",
  core: "--chart-4",
  bug: "--chart-bad",
  perf: "--chart-3",
  chore: "--chart-6",
  docs: "--chart-5",
  refactor: "--chart-2",
};

// 7 days × 24 hours activity (0..1), deterministic (matches shared.jsx WORK_HEATMAP).
const WORK_HEATMAP: WorkHeatmap = (() => {
  const grid: number[][] = [];
  for (let d = 0; d < 7; d++) {
    const weekend = d >= 5;
    const row: number[] = [];
    for (let h = 0; h < 24; h++) {
      const n = ((d * 31 + h * 17) % 11) / 11;
      const core = h >= 8 && h < 18;
      let v: number;
      if (weekend) v = n > 0.84 ? 0.3 : 0;
      else if (core) v = 0.55 + (1 - Math.abs(13 - h) / 6) * 0.35 + n * 0.1;
      else if (h >= 18 && h < 22) v = n > 0.5 ? 0.18 + n * 0.3 : 0;
      else if (h >= 6 && h < 8) v = n > 0.55 ? 0.22 : 0;
      else v = n > 0.88 ? 0.25 : 0;
      row.push(Math.min(1, +v.toFixed(2)));
    }
    grid.push(row);
  }
  return grid;
})();

const AWARENESS: AwarenessEntry[] = [
  { who: "mara", branch: "feat/capability-cache", pr: "#1283", act: "editing broker.ts", when: "2m ago", files: ["broker.ts", "registry.ts"], status: "active", overlap: "broker.ts" },
  { who: "jdev", branch: "perf/broker-grant", pr: "#1279", act: "pushed 3 commits", when: "18m ago", files: ["broker.ts"], status: "active", overlap: "broker.ts" },
  { who: "kai", branch: "feat/session-resume", pr: "#1280", act: "opened a PR", when: "1h ago", files: ["session-tree.ts"], status: "idle" },
  { who: "lea", branch: "refactor/session-store", pr: "#1255", act: "left 2 comments", when: "3h ago", files: ["session-store.ts"], status: "idle" },
];

// B-pre: the GitProvider contract is async (real impl reads the git sidecar /
// forge API). The mock resolves deterministically. `overdueThresholdDays` and
// `labelChartVar` are pure and stay synchronous per the contract.
export const mockGitProvider: GitProvider = {
  overdueThresholdDays: OVERDUE_THRESHOLD_DAYS,

  getPullRequests: () => Promise.resolve(PULL_REQUESTS),
  getMyPullRequests: () => Promise.resolve(PULL_REQUESTS.filter((p) => p.author === "you")),
  getReviewRequested: () =>
    Promise.resolve(PULL_REQUESTS.filter((p) => p.requested || p.reviewedByMe)),
  getOverdue: (threshold: number = OVERDUE_THRESHOLD_DAYS) =>
    Promise.resolve(PULL_REQUESTS.filter((p) => !p.draft && p.days > threshold)),
  getWeeks: () => Promise.resolve(WEEKS),
  getSeries: () => Promise.resolve(SERIES),
  getDora: () => Promise.resolve(DORA),
  getPrCategories: () => Promise.resolve(PR_CATEGORIES),
  getLanguages: () => Promise.resolve(LANGS),
  getActivityStats: () => Promise.resolve(ACTIVITY),
  getWorkHeatmap: () => Promise.resolve(WORK_HEATMAP),
  getAwareness: () => Promise.resolve(AWARENESS),
  labelChartVar: (label: string): string => LABEL_CHART_VARS[label] ?? "--chart-6",
};

/**
 * Synchronous deterministic facade over the same fixtures — for the Git
 * dashboard, a SNAPSHOT view (build-spec §5), mirroring the async `GitProvider`
 * method names so a consumer swaps one import line. The async provider stays
 * the contract seam (real forge/sidecar swap); this is the instant-paint
 * mirror, deterministic and poll-free.
 */
export const gitSnapshot = {
  overdueThresholdDays: OVERDUE_THRESHOLD_DAYS,
  getPullRequests: () => PULL_REQUESTS,
  getMyPullRequests: () => PULL_REQUESTS.filter((p) => p.author === "you"),
  getReviewRequested: () => PULL_REQUESTS.filter((p) => p.requested || p.reviewedByMe),
  getOverdue: (threshold: number = OVERDUE_THRESHOLD_DAYS) =>
    PULL_REQUESTS.filter((p) => !p.draft && p.days > threshold),
  getWeeks: () => WEEKS,
  getSeries: () => SERIES,
  getDora: () => DORA,
  getPrCategories: () => PR_CATEGORIES,
  getLanguages: () => LANGS,
  getActivityStats: () => ACTIVITY,
  getWorkHeatmap: () => WORK_HEATMAP,
  getAwareness: () => AWARENESS,
  labelChartVar: (label: string): string => LABEL_CHART_VARS[label] ?? "--chart-6",
};
