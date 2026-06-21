import type {
  ChangeSet,
  DiffDoc,
  DiffRow,
  Project,
  PullRequest,
  ScratchNode,
  SearchResult,
  SymbolNode,
  WorkStash,
} from "@/contracts";

// Deterministic mock subset grounded in the prototype's shared.jsx (R4 expands
// the per-view data). No Date.now / Math.random anywhere.
export const mockProjects: Project[] = [
  {
    id: "core",
    name: "capisco-core",
    path: "~/dev/capisco/core",
    branch: "feat/worktree-teardown",
    tracking: "↓3",
    expanded: true,
    selected: true,
    files: [
      { depth: 1, ext: "dir", name: "src", expandable: true, expanded: true },
      { depth: 2, ext: "dir", name: "core", expandable: true, expanded: true },
      { depth: 3, ext: "ts", name: "worktree.ts", git: "M" },
      { depth: 3, ext: "ts", name: "session-tree.ts", git: "M" },
      { depth: 3, ext: "ts", name: "broker.ts", git: "A", active: true },
      { depth: 2, ext: "dir", name: "providers", expandable: true },
      { depth: 1, ext: "json", name: "package.json" },
    ],
  },
  {
    id: "tauri",
    name: "capisco-tauri",
    path: "~/dev/capisco/tauri",
    branch: "main",
    tracking: "↑2",
    files: [
      { depth: 1, ext: "dir", name: "src", expandable: true },
      { depth: 1, ext: "rs", name: "main.rs", git: "M" },
    ],
  },
];

// Global "Scratches and Consoles" tree — shared across all loaded projects.
export const mockScratches: ScratchNode[] = [
  { ext: "ts", name: "scratch_1.ts" },
  { ext: "md", name: "broker-notes.md" },
  { ext: "json", name: "response_42.json" },
];

// Deterministic diff (shared.jsx DIFF) plus a long deterministic tail so the
// virtualized diff list is exercised in tests (no Date.now / Math.random).
const baseDiffRows: DiffRow[] = [
  { l: { n: 16, t: "  async dispose() {" }, r: { n: 16, t: "  async dispose() {" }, k: "ctx" },
  { l: { n: 17, t: "    this.watcher.close();" }, r: { n: 17, t: "    this.watcher.close();" }, k: "ctx" },
  { l: null, r: { n: 18, t: "    await this.teardown();" }, k: "add" },
  { l: { n: 18, t: "  }" }, r: { n: 19, t: "  }" }, k: "ctx" },
  { l: null, r: { n: 20, t: "" }, k: "add" },
  { l: null, r: { n: 21, t: "  async teardown() {" }, k: "add" },
  { l: null, r: { n: 22, t: "    await this.broker.release(this.port);" }, k: "add" },
  { l: { n: 19, t: "    // TODO: free the port" }, r: null, k: "del" },
  { l: null, r: { n: 23, t: "    await rm(this.dir, { recursive: true });" }, k: "add" },
  { l: null, r: { n: 24, t: "  }" }, k: "add" },
  { l: { n: 20, t: "}" }, r: { n: 25, t: "}" }, k: "ctx" },
];

// Long deterministic context tail (100 rows) to prove virtualization.
const longTail: DiffRow[] = Array.from({ length: 100 }, (_, i) => {
  const ln = 26 + i;
  return {
    l: { n: ln, t: `  // context line ${i} — a fairly long line to exercise horizontal scrolling within the diff body` },
    r: { n: ln, t: `  // context line ${i} — a fairly long line to exercise horizontal scrolling within the diff body` },
    k: "ctx" as const,
  };
});

export const mockDiff: DiffDoc = {
  file: "src/core/worktree.ts",
  ext: "ts",
  added: 8,
  removed: 1,
  rows: [...baseDiffRows, ...longTail],
};

export const mockPullRequests: PullRequest[] = [
  {
    num: 1284,
    title: "Worktree teardown frees its allocated port",
    repo: "capisco-core",
    branch: "feat/worktree-teardown",
    author: "you",
    draft: false,
    days: 1,
    checks: "passing",
    comments: 4,
    add: 128,
    del: 47,
    labels: ["feature", "core"],
    reviews: [
      { who: "mara", state: "approved" },
      { who: "kai", state: "pending" },
    ],
  },
];

// Changes vs a base branch (shared.jsx COMPARE_BRANCHES / CHANGESET / CHANGES_HAS_PR).
export const mockChangeSet: ChangeSet = {
  hasPullRequest: true,
  branches: [
    { id: "develop", name: "develop", role: "target" }, // PR target
    { id: "main", name: "main", role: "parent" }, // branched from
    { id: "release/1.4", name: "release/1.4" },
    { id: "release/1.3", name: "release/1.3" },
    { id: "feat/session-resume", name: "feat/session-resume" },
    { id: "feat/capability-cache", name: "feat/capability-cache" },
    { id: "fix/port-allocator", name: "fix/port-allocator" },
    { id: "chore/ci-cache", name: "chore/ci-cache" },
  ],
  files: [
    { name: "worktree.ts", path: "src/core", ext: "ts", git: "M", added: 12, removed: 4 },
    { name: "broker.ts", path: "src/core", ext: "ts", git: "A", added: 96, removed: 0 },
    { name: "session-tree.ts", path: "src/core", ext: "ts", git: "M", added: 24, removed: 8 },
    { name: "main.rs", path: "src-tauri", ext: "rs", git: "M", added: 6, removed: 2 },
    { name: "package.json", path: ".", ext: "json", git: "M", added: 2, removed: 1 },
  ],
};

/** The current branch the Changes view diffs against its base. */
export const mockCurrentBranch = "feat/worktree-teardown";

// Commit / Work-Stash (shared.jsx CHANGE_GROUPS / SHELF).
export const mockWorkStash: WorkStash = {
  commitBranch: "feat/worktree-teardown",
  groups: [
    {
      project: "capisco-core",
      branch: "feat/worktree-teardown",
      files: [
        { name: "worktree.ts", path: "core", ext: "ts", git: "M", added: 12, removed: 4 },
        { name: "broker.ts", path: "core", ext: "ts", git: "A", added: 96, removed: 0 },
        { name: "broker.test.ts", path: "core", ext: "ts", git: "A", added: 140, removed: 0 },
      ],
    },
    {
      project: "capisco-tauri",
      branch: "main",
      files: [{ name: "main.rs", path: "src", ext: "rs", git: "M", added: 6, removed: 2 }],
    },
  ],
  shelf: [
    { name: "client-api-integration", meta: "2 files · 2h ago" },
    { name: "port-allocator spike", meta: "1 file · yesterday" },
    { name: "local-model provider", meta: "4 files · 3d ago" },
  ],
};

// Global search, ripgrep-style (shared.jsx SEARCH), with a long deterministic
// tail so the virtualized result list is exercised in tests.
const baseSearchFiles = [
  {
    path: "src/core/broker.ts",
    hits: [
      { line: 18, before: "const granted = await this.", match: "checkCapability", after: "(principal, cap);" },
      { line: 42, before: "  if (await this.", match: "checkCapability", after: "(p, c)) {" },
    ],
  },
  {
    path: "src/core/session-tree.ts",
    hits: [{ line: 91, before: "broker.", match: "checkCapability", after: "(agent, cap)" }],
  },
];

// 40 synthetic files × 3 hits each → 120 extra hits to prove virtualization.
const longSearchTail = Array.from({ length: 40 }, (_, i) => ({
  path: `src/providers/provider-${String(i).padStart(2, "0")}.ts`,
  hits: Array.from({ length: 3 }, (_, j) => ({
    line: 10 + j * 7,
    before: "    return this.",
    match: "checkCapability",
    after: `(principal, scope${j});`,
  })),
}));

export const mockSearch: SearchResult = {
  query: "checkCapability",
  files: [...baseSearchFiles, ...longSearchTail],
};

// Structure outline keyed by active file (shared.jsx STRUCTURE = broker.ts).
const STRUCTURE_BY_FILE: Record<string, SymbolNode[]> = {
  "broker.ts": [
    { kind: "C", name: "Broker", depth: 0 },
    { kind: "p", name: "grants: Map<string, Scope>", depth: 1 },
    { kind: "m", name: "constructor(registry)", depth: 1 },
    { kind: "m", name: "checkCapability(principal, cap, scope)", depth: 1 },
    { kind: "m", name: "prompt(principal, cap)", depth: 1 },
    { kind: "m", name: "release(port)", depth: 1 },
    { kind: "I", name: "Capability", depth: 0 },
    { kind: "E", name: "Scope", depth: 0 },
  ],
};

/** Symbol outline of `file` (basename match), or [] when none is known. */
export function mockStructure(file: string): SymbolNode[] {
  const base = file.split("/").pop() ?? file;
  return STRUCTURE_BY_FILE[base] ?? [];
}
