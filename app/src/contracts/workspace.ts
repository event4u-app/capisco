/**
 * Data-shape contracts for Explorer/Changes, Git-Dashboard and Tasks
 * (build-spec §3, §5, §6). Grounded in the prototype's `shared.jsx` shapes.
 */

export type GitMarker = "M" | "A" | "D" | "U";

export interface FileNode {
  depth: number;
  name: string;
  /** "dir" | "ts" | "rs" | "json" | "md" | … (file-type icon hint). */
  ext: string;
  expandable?: boolean;
  expanded?: boolean;
  active?: boolean;
  git?: GitMarker;
}

/**
 * A git **repository** (§2.1) — one remote + a default branch. A repo has N
 * worktrees. The repo carries the identity the remote knows; per-checkout state
 * (path / branch / base) lives on `Worktree`, never here.
 */
export interface Repo {
  id: string;
  name: string;
  /** Remote URL or shorthand (e.g. "git@github.com:acme/core.git"). */
  remote?: string;
  /** The repo's default branch (e.g. "main"). */
  defaultBranch: string;
}

/**
 * A git **worktree** (§2.1) — one checkout of a `Repo` at a path, on a branch,
 * branched from a base. The Explorer and Changes views map onto worktrees, not
 * repos: a single repo can have several worktrees open side-by-side.
 */
export interface Worktree {
  id: string;
  /** The `Repo` this worktree is a checkout of. */
  repoId: string;
  /** Display name (defaults to the repo name; may disambiguate the checkout). */
  name: string;
  /** Filesystem path of this checkout. */
  path: string;
  /** Branch this worktree currently has checked out. */
  branch: string;
  /** Branch this worktree was created from (its base). */
  base: string;
  /** Ahead/behind tracking shorthand vs upstream (e.g. "↓3"). */
  tracking?: string;
  expanded?: boolean;
  selected?: boolean;
  files: FileNode[];
}

/**
 * @deprecated B-pre split `Project` into {@link Repo} + {@link Worktree}.
 * Retained as a structural alias of `Worktree` for any straggling consumer; new
 * code consumes `Worktree`.
 */
export type Project = Worktree;

/** A global "Scratches and Consoles" leaf — shared across all loaded projects. */
export interface ScratchNode {
  name: string;
  ext: string;
}

export interface DiffStat {
  added: number;
  removed: number;
}

/** One side of a diff row: line number + text. */
export interface DiffSide {
  n: number;
  t: string;
}

export type DiffRowKind = "ctx" | "add" | "del";

/** A side-by-side diff row. `l` = left/old, `r` = right/new (null = filler). */
export interface DiffRow {
  l: DiffSide | null;
  r: DiffSide | null;
  k: DiffRowKind;
}

export interface DiffDoc extends DiffStat {
  file: string;
  ext: string;
  rows: DiffRow[];
}

export interface ChangeFile extends DiffStat {
  name: string;
  path: string;
  ext: string;
  git: GitMarker;
}

export interface CompareBranch {
  id: string;
  name: string;
  /** "target" (PR target) | "parent" (branched-from) | undefined (other). */
  role?: "target" | "parent";
}

export interface ChangeSet {
  hasPullRequest: boolean;
  branches: CompareBranch[];
  files: ChangeFile[];
}

/** Commit / Work-Stash (build-spec §3). Local Changes grouped per project + git Shelf. */
export interface ChangeGroup {
  project: string;
  branch: string;
  files: ChangeFile[];
}

export interface ShelfEntry {
  name: string;
  /** "<n> files · <relative time>" — pre-rendered, deterministic. */
  meta: string;
}

export interface WorkStash {
  /** Branch the primary "Commit to <branch>" button targets. */
  commitBranch: string;
  groups: ChangeGroup[];
  shelf: ShelfEntry[];
}

/** Global search (ripgrep-style), grouped by file (build-spec §3). */
export interface SearchHit {
  /** 1-based line number of the match. */
  line: number;
  /** Text before the match on the line. */
  before: string;
  /** The matched substring (highlighted). */
  match: string;
  /** Text after the match on the line. */
  after: string;
}

export interface SearchFile {
  path: string;
  hits: SearchHit[];
}

export interface SearchResult {
  query: string;
  files: SearchFile[];
}

/** Structure outline (build-spec §3): symbol of the active file with a kind badge.
 * Kinds: C(lass) | m(ethod) | p(roperty) | I(nterface) | E(num). */
export type SymbolKind = "C" | "m" | "p" | "I" | "E";

export interface SymbolNode {
  kind: SymbolKind;
  name: string;
  depth: number;
}

export type PrChecks = "passing" | "failing" | "pending";
export type ReviewState = "approved" | "changes" | "pending";

export interface PullRequest {
  num: number;
  title: string;
  repo: string;
  branch: string;
  author: string;
  draft: boolean;
  days: number;
  checks: PrChecks;
  comments: number;
  add: number;
  del: number;
  labels: string[];
  reviews: { who: string; state: ReviewState }[];
  requested?: boolean;
  reviewedByMe?: boolean;
}

export interface Metric {
  label: string;
  value: string;
  tier?: string;
  delta?: string;
  good?: boolean;
  sub?: string;
}

export interface AwarenessEntry {
  who: string;
  branch: string;
  pr: string;
  act: string;
  when: string;
  files: string[];
  status: "active" | "idle";
  overlap?: string;
}

/** 7×24 grid value 0..1 (activity volume) for the working-times heatmap. */
export type WorkHeatmap = number[][];

/** One language row in the activity breakdown (build-spec §5). `chartVar` is the
 * CSS chart-palette var name (e.g. "--chart-1") — never a hardcoded colour. */
export interface LangStat {
  name: string;
  pct: number;
  chartVar: string;
}

/** A donut segment (PR categories, work-type split). `chartVar` → chart palette. */
export interface DonutSegment {
  label: string;
  value: number;
  chartVar: string;
}

/** Weekly time-series for the Activity / Overview line charts. Indexes align
 * with `GitProvider.getWeeks()`. */
export interface WeeklySeries {
  commits: number[];
  prsMerged: number[];
  loc: number[];
  reviews: number[];
  cycleTime: number[];
}

/** Headline activity counters (commits / PRs / lines) for the Activity tab. */
export interface ActivityStats {
  commits: number;
  prsOpened: number;
  prsMerged: number;
  added: number;
  removed: number;
  /** Per-weekday commit volume + matching single-letter day labels. */
  perDay: number[];
  dayLabels: string[];
}

export type TicketType = "feature" | "bug" | "chore";
export type TicketStatus = "backlog" | "todo" | "progress" | "review" | "testing" | "done";

export interface Ticket {
  id: string;
  title: string;
  type: TicketType;
  points: number;
  status: TicketStatus;
  who: string;
  mine?: boolean;
  epic?: string;
  branch?: string;
  sub?: string;
}

export interface Epic {
  id: string;
  label: string;
}

/** A board column = a ticket status with a human label (Linear-style). */
export interface TicketColumn {
  id: TicketStatus;
  label: string;
}

export interface Sprint {
  name: string;
  day: number;
  days: number;
  committed: number;
  done: number;
}

/** Remaining story points per sprint day; null = future. */
export type BurndownSeries = (number | null)[];

/** Sprint + private burndown: ideal (dashed) vs actual (solid, stops at today). */
export interface Burndown {
  ideal: BurndownSeries;
  team: BurndownSeries;
  myIdeal: BurndownSeries;
  mine: BurndownSeries;
}

/** Per-person WIP vs limit row (Tasks Insights). */
export interface WipRow {
  who: string;
  wip: number;
  limit: number;
}

/**
 * Workspace data provider (B-pre: async). Repos + worktrees, the change set,
 * the work-stash, search and structure outline — the Explorer/Changes/Search/
 * Commit surfaces map onto worktrees, not repos (§2.1). Real impl reads the git
 * sidecar; mock resolves deterministically.
 */
export interface WorkspaceProvider {
  /** The repos loaded in the workspace. */
  listRepos(): Promise<Repo[]>;
  /** The worktrees (checkouts) the Explorer/Changes views render. */
  listWorktrees(): Promise<Worktree[]>;
  /** Global "Scratches and Consoles" leaves, shared across worktrees. */
  listScratches(): Promise<ScratchNode[]>;
  /** Side-by-side diff document for a file (R1). */
  getDiff(file?: string): Promise<DiffDoc>;
  /** Changes vs a base branch + PR linkage. */
  getChangeSet(): Promise<ChangeSet>;
  /** Branch the Changes view diffs against its base. */
  getCurrentBranch(): Promise<string>;
  /** Local changes grouped per worktree + the git shelf. */
  getWorkStash(): Promise<WorkStash>;
  /** Global ripgrep-style search, grouped by file. */
  getSearch(): Promise<SearchResult>;
  /** Symbol outline of `file` (basename match), or [] when none is known. */
  getStructure(file: string): Promise<SymbolNode[]>;
}

/** Git-Dashboard provider (B-pre: async). build-spec §5. */
export interface GitProvider {
  /** Overdue threshold in days (build-plan §3 correction: 7, configurable). */
  readonly overdueThresholdDays: number;
  getPullRequests(): Promise<PullRequest[]>;
  getMyPullRequests(): Promise<PullRequest[]>;
  getReviewRequested(): Promise<PullRequest[]>;
  getOverdue(threshold?: number): Promise<PullRequest[]>;
  getWeeks(): Promise<string[]>;
  getSeries(): Promise<WeeklySeries>;
  getDora(): Promise<Metric[]>;
  getPrCategories(): Promise<DonutSegment[]>;
  getLanguages(): Promise<LangStat[]>;
  getActivityStats(): Promise<ActivityStats>;
  getWorkHeatmap(): Promise<WorkHeatmap>;
  getAwareness(): Promise<AwarenessEntry[]>;
  /** Chart-palette var name for a PR/ticket label (pure — stays synchronous). */
  labelChartVar(label: string): string;
}

/** Per-ticket detail (description + activity thread). */
export interface TicketDetail {
  description: string;
  comments: { who: string; when: string; text: string }[];
}

/** Tasks-Workspace provider (B-pre: async). build-spec §6. */
export interface TasksProvider {
  /** WIP limit per person (Insights). */
  readonly wipLimit: number;
  getSprint(): Promise<Sprint>;
  getTickets(): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  getEpics(): Promise<Epic[]>;
  getColumns(): Promise<TicketColumn[]>;
  getMyTickets(): Promise<Ticket[]>;
  getActiveTickets(): Promise<Ticket[]>;
  getBurndown(): Promise<Burndown>;
  getTeamWip(): Promise<WipRow[]>;
  getMyWipSeries(): Promise<number[]>;
  getReviewsGiven(): Promise<number[]>;
  getThroughput(): Promise<number[]>;
  getSprintDayLabels(): Promise<string[]>;
  getTypeSplit(): Promise<DonutSegment[]>;
  getTicketDetail(id: string): Promise<TicketDetail>;
  /** Pure lookups — stay synchronous. */
  epicLabel(epicId: string | undefined): string;
  typeChartVar(type: string): string;
}
