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

export interface Project {
  id: string;
  name: string;
  path: string;
  branch: string;
  tracking?: string;
  expanded?: boolean;
  selected?: boolean;
  files: FileNode[];
}

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
