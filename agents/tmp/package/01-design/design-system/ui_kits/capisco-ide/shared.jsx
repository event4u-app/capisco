/* Capisco IDE kit — shared helpers, icons, sample content. */

// Safe Lucide icon: React owns the <span>, lucide mutates inner HTML only.
function Icon({ name, size = 16, color, style = {} }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = '<i data-lucide="' + name + '"></i>';
    window.lucide.createIcons();
  }, [name]);
  return (
    <span
      ref={ref}
      className="lc"
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, color, flexShrink: 0, ...style }}
    />
  );
}

function FileIcon({ ext, open }) {
  if (ext === 'dir') return <Icon name={open ? 'folder-open' : 'folder'} size={15} color="var(--text-secondary)" />;
  const map = {
    ts:   { name: 'file-code', color: 'var(--syn-type)' },
    rs:   { name: 'file-code', color: 'var(--syn-number)' },
    json: { name: 'braces',    color: 'var(--syn-keyword)' },
    md:   { name: 'file-text', color: 'var(--text-secondary)' },
  };
  const m = map[ext] || { name: 'file', color: 'var(--text-secondary)' };
  return <Icon name={m.name} size={15} color={m.color} />;
}

// ---- Multi-project workspace: several repos loaded side-by-side so the
//      agent has them all as context, plus a global scratch tree. ----
const PROJECTS = [
  {
    id: 'core', name: 'capisco-core', path: '~/dev/capisco/core',
    branch: 'feat/worktree-teardown', tracking: '↓3', expanded: true, selected: true,
    files: [
      { depth: 1, ext: 'dir', name: 'src', expandable: true, expanded: true },
      { depth: 2, ext: 'dir', name: 'core', expandable: true, expanded: true },
      { depth: 3, ext: 'ts', name: 'worktree.ts', git: 'M' },
      { depth: 3, ext: 'ts', name: 'session-tree.ts', git: 'M' },
      { depth: 3, ext: 'ts', name: 'broker.ts', git: 'A', active: true },
      { depth: 2, ext: 'dir', name: 'providers', expandable: true },
      { depth: 1, ext: 'json', name: 'package.json' },
    ],
  },
  {
    id: 'tauri', name: 'capisco-tauri', path: '~/dev/capisco/tauri',
    branch: 'main', tracking: '↑2', expanded: false,
    files: [
      { depth: 1, ext: 'dir', name: 'src', expandable: true },
      { depth: 1, ext: 'rs', name: 'main.rs', git: 'M' },
    ],
  },
];

// Global scratch tree (shared across all loaded projects)
const SCRATCH = [
  { ext: 'ts', name: 'scratch_1.ts' },
  { ext: 'md', name: 'broker-notes.md' },
  { ext: 'json', name: 'response_42.json' },
];

// ---- Editor tabs ----
const TABS = [
  { ext: 'ts', name: 'worktree.ts', pinned: true },
  { ext: 'ts', name: 'broker.ts' },
  { ext: 'ts', name: 'session-tree.ts' },
  { ext: 'md', name: 'README.md', dirty: true },
];

// ---- Work Stash · Local Changes (grouped by project) + Shelf ----
const CHANGE_GROUPS = [
  {
    project: 'capisco-core', branch: 'feat/worktree-teardown',
    files: [
      { ext: 'ts', name: 'worktree.ts', path: 'core', git: 'M' },
      { ext: 'ts', name: 'broker.ts', path: 'core', git: 'A' },
      { ext: 'ts', name: 'broker.test.ts', path: 'core', git: 'A' },
    ],
  },
  {
    project: 'capisco-tauri', branch: 'main',
    files: [{ ext: 'rs', name: 'main.rs', path: 'src', git: 'M' }],
  },
];
const SHELF = [
  { name: 'client-api-integration', meta: '2 files · 2h ago' },
  { name: 'port-allocator spike', meta: '1 file · yesterday' },
  { name: 'local-model provider', meta: '4 files · 3d ago' },
];

// ---- Agent sessions (top-level, with subagents) ----
const SESSIONS = [
  {
    id: 's1', model: 'Claude', status: 'running',
    title: 'Implement worktree teardown', meta: '2m 49s · 6.5k ↓',
    subs: [{ id: 's1a', model: 'Claude', status: 'running', title: 'Subagent · write tests', meta: '0m 31s · 1.2k ↓' }],
  },
  { id: 's2', model: 'GPT-5', status: 'idle', title: 'Refactor broker grant model', meta: 'idle · 18k ↓' },
  { id: 's3', model: 'Local', status: 'waiting', title: 'Search: "where is port allocated?"', meta: 'waiting' },
];

// ---- Flyout content ----
const ALERTS = [
  { sev: 'waiting', title: 'Local session needs approval', sub: 'Bash(rm -rf .worktrees/tmp)' },
  { sev: 'success', title: '3 tests passed', sub: 'core/broker.test.ts · 312ms' },
  { sev: 'warning', title: 'Unused import in broker.ts', sub: 'Scope is never used · Ln 3' },
  { sev: 'idle', title: 'GPT-5 session idle 4m', sub: 'Refactor broker grant model' },
];
const INSPECTIONS = [
  { sev: 'warning', title: 'broker.ts — 1 weak warning', sub: 'Prefer const over let · Ln 18' },
  { sev: 'success', title: 'worktree.ts — clean', sub: 'No problems found' },
  { sev: 'idle', title: 'Typecheck', sub: 'tsc --noEmit · passing' },
];

// ---- PR / Forge board ("whose turn is it?") ----
const PRS = {
  yourTurn: [
    { title: 'Add capability scope cache', repo: 'capisco-core', author: 'mara', age: '3h', status: 'review', stale: false },
    { title: 'Port allocator: avoid TOCTOU', repo: 'capisco-tauri', author: 'jdev', age: '9d', status: 'review', stale: true },
  ],
  awaiting: [
    { title: 'Worktree teardown + port release', repo: 'capisco-core', author: 'you', age: '1h', status: 'open', reviewers: 'mara, kai' },
    { title: 'Session-tree token aggregation', repo: 'capisco-core', author: 'you', age: '2d', status: 'changes', reviewers: 'mara' },
  ],
};

// ---- Git dashboard (local-first personal metrics) ----
const GIT_STATS = {
  commits: 47, prsOpened: 6, prsMerged: 4, added: 3128, removed: 1407,
  langs: [
    { name: 'TypeScript', pct: 62, color: 'var(--syn-type)' },
    { name: 'Rust', pct: 21, color: 'var(--syn-number)' },
    { name: 'CSS', pct: 11, color: 'var(--syn-keyword)' },
    { name: 'Markdown', pct: 6, color: 'var(--text-secondary)' },
  ],
  activity: [3, 7, 5, 9, 12, 6, 8],
  days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
};

// ---- Global search (ripgrep-style) ----
const SEARCH = {
  query: 'checkCapability',
  files: [
    { path: 'src/core/broker.ts', hits: [
      { ln: 18, before: 'const granted = await this.', match: 'checkCapability', after: '(principal, cap);' },
      { ln: 42, before: '  if (await this.', match: 'checkCapability', after: '(p, c)) {' },
    ] },
    { path: 'src/core/session-tree.ts', hits: [
      { ln: 91, before: 'broker.', match: 'checkCapability', after: '(agent, cap)' },
    ] },
  ],
};

// ---- Structure (symbols of the active file) ----
const STRUCTURE = [
  { kind: 'C', name: 'Broker', depth: 0 },
  { kind: 'p', name: 'grants: Map<string, Scope>', depth: 1 },
  { kind: 'm', name: 'constructor(registry)', depth: 1 },
  { kind: 'm', name: 'checkCapability(principal, cap, scope)', depth: 1 },
  { kind: 'm', name: 'prompt(principal, cap)', depth: 1 },
  { kind: 'm', name: 'release(port)', depth: 1 },
  { kind: 'I', name: 'Capability', depth: 0 },
  { kind: 'E', name: 'Scope', depth: 0 },
];

// ---- Datasource explorer (prod read-only invariant) ----
const DATASOURCES = [
  { name: 'local', engine: 'postgres', env: 'local', tables: ['users', 'sessions', 'grants', 'worktrees'] },
  { name: 'staging', engine: 'postgres', env: 'staging', tables: ['users', 'sessions', 'grants'] },
  { name: 'prod', engine: 'postgres', env: 'production', readonly: true, tables: ['users', 'sessions', 'grants', 'audit_log'] },
  { name: 'cache', engine: 'redis', env: 'local', tables: ['keys'] },
];

// ---- Git dashboard: weekly series + DORA + working-times heatmap ----
const GIT_WEEKS = ['23 Mar', '30 Mar', '06 Apr', '13 Apr', '20 Apr', '27 Apr', '04 May', '11 May', '18 May', '25 May', '01 Jun', '08 Jun', '15 Jun'];
const GIT_SERIES = {
  commits:   [102, 64, 196, 455, 470, 432, 590, 695, 448, 675, 712, 540, 210],
  prsMerged: [45, 26, 9, 27, 20, 8, 62, 89, 51, 120, 157, 158, 47],
  loc:       [370, 118, 12, 205, 135, 128, 165, 200, 970, 1040, 225, 375, 90],
  reviews:   [8, 2, 0, 0, 2, 1, 6, 3, 9, 1, 11, 3, 0],
  cycleTime: [186, 57, 54, 68, 55, 156, 162, 42, 79, 40, 8, 13, 31],
};
const GIT_DORA = [
  { label: 'Lead Time for Changes', value: '61.4 h', tier: 'High', delta: '↓74.1%', good: true, sub: 'Avg. time from first commit to merge' },
  { label: 'Deployment Frequency', value: '74.5 / wk', tier: 'Elite', delta: '↑410.3%', good: true, sub: 'PRs merged per week (proxy)' },
  { label: 'Change Failure Rate', value: '3 %', tier: 'Elite', delta: '↓41.2%', good: true, sub: 'Merged with failed CI checks' },
];
const PR_CATEGORIES = [
  { label: 'Planned', value: 64, color: 'var(--accent)' },
  { label: 'Unplanned', value: 36, color: 'var(--git-modified)' },
];

// ---- Detailed PRs for the loaded projects (GitHub-like) ----
const GIT_PRS = [
  { num: 1284, title: 'Worktree teardown frees its allocated port', repo: 'capisco-core', branch: 'feat/worktree-teardown', author: 'you', draft: false, days: 1, checks: 'passing', comments: 4, add: 128, del: 47, labels: ['feature', 'core'], reviews: [{ who: 'mara', state: 'approved' }, { who: 'kai', state: 'pending' }] },
  { num: 1280, title: 'Session resume from store', repo: 'capisco-core', branch: 'feat/session-resume', author: 'you', draft: false, days: 5, checks: 'failing', comments: 9, add: 540, del: 120, labels: ['feature'], reviews: [{ who: 'mara', state: 'changes' }] },
  { num: 1276, title: 'Port allocator avoids TOCTOU', repo: 'capisco-tauri', branch: 'fix/port-allocator', author: 'you', draft: true, days: 2, checks: 'pending', comments: 1, add: 64, del: 18, labels: ['bug'], reviews: [] },
  { num: 1271, title: 'CI: cache pnpm store between runs', repo: 'capisco-core', branch: 'chore/ci-cache', author: 'you', draft: false, days: 8, checks: 'passing', comments: 0, add: 60, del: 12, labels: ['chore'], reviews: [] },
  { num: 1283, title: 'Capability scope cache', repo: 'capisco-core', branch: 'feat/capability-cache', author: 'mara', draft: false, days: 0, checks: 'passing', comments: 2, add: 210, del: 30, labels: ['feature'], reviews: [{ who: 'you', state: 'pending' }], requested: true },
  { num: 1279, title: 'Broker grant model perf pass', repo: 'capisco-tauri', branch: 'perf/broker-grant', author: 'jdev', draft: false, days: 9, checks: 'passing', comments: 6, add: 96, del: 140, labels: ['perf'], reviews: [{ who: 'you', state: 'pending' }, { who: 'mara', state: 'approved' }], reviewedByMe: true },
  { num: 1268, title: 'Docs: capability broker overview', repo: 'capisco-core', branch: 'docs/broker', author: 'sam', draft: false, days: 2, checks: 'passing', comments: 1, add: 80, del: 4, labels: ['docs'], reviews: [{ who: 'you', state: 'pending' }], requested: true },
  { num: 1255, title: 'Refactor session store internals', repo: 'capisco-core', branch: 'refactor/session-store', author: 'lea', draft: false, days: 12, checks: 'passing', comments: 14, add: 820, del: 610, labels: ['refactor'], reviews: [{ who: 'mara', state: 'approved' }] },
];
const LABEL_COLORS = { feature: 'var(--accent)', core: 'var(--syn-control)', bug: 'var(--error)', perf: 'var(--warning)', chore: 'var(--text-tertiary)', docs: 'var(--success)', refactor: 'var(--syn-keyword)' };
// 7 days × 24 hours activity (0..1), deterministic. Core hours dense, off-hours sparse.
const WORK_HEATMAP = (() => {
  const grid = [];
  for (let d = 0; d < 7; d++) {
    const weekend = d >= 5;
    const row = [];
    for (let h = 0; h < 24; h++) {
      const n = ((d * 31 + h * 17) % 11) / 11;        // 0..0.9 deterministic
      const core = h >= 8 && h < 18;
      let v = 0;
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

// ---- Docker / container management (ctop-like), grouped by loaded project ----
const CONTAINER_GROUPS = [
  { project: 'capisco-core', services: [
    { name: 'web', image: 'node:22', status: 'running', cpu: 34, mem: '412 MB', memPct: 41, ports: '5173→5173', uptime: '2h 14m' },
    { name: 'postgres', image: 'postgres:16', status: 'running', cpu: 2, mem: '96 MB', memPct: 10, ports: '5432→5432', uptime: '3d' },
    { name: 'traefik', image: 'traefik:v3', status: 'running', cpu: 1, mem: '48 MB', memPct: 5, ports: '80, 443', uptime: '3d' },
    { name: 'playwright', image: 'playwright:1.49', status: 'exited', cpu: 0, mem: '0 MB', memPct: 0, ports: '—', uptime: '—' },
  ] },
  { project: 'capisco-tauri', services: [
    { name: 'tauri-build', image: 'rust:1.81', status: 'running', cpu: 8, mem: '128 MB', memPct: 13, ports: '—', uptime: '2h 14m' },
    { name: 'redis', image: 'redis:7', status: 'running', cpu: 1, mem: '24 MB', memPct: 3, ports: '6379→6379', uptime: '2h 14m' },
  ] },
];

// ---- Task board (Jira / Linear) ----
const TASKS = {
  progress: [{ id: 'CAP-142', title: 'Worktree teardown frees its port', type: 'feature', points: 3 }],
  review: [{ id: 'CAP-139', title: 'Capability scope cache', type: 'feature', points: 3 }],
  todo: [
    { id: 'CAP-148', title: 'Broker: immutable grants once issued', type: 'feature', points: 5 },
    { id: 'CAP-151', title: 'Port allocator avoids TOCTOU', type: 'bug', points: 2 },
    { id: 'CAP-153', title: 'Session resume from store', type: 'feature', points: 8 },
  ],
};

// ---- Tickets dashboard (Jira / Linear), richer model for the Tasks workspace ----
const SPRINT = { name: 'Sprint 24', day: 6, days: 10, committed: 52, done: 19 };
// status: backlog | todo | progress | review | testing | done
const TICKETS = [
  { id: 'CAP-142', title: 'Worktree teardown frees its allocated port', type: 'feature', points: 3, status: 'progress', who: 'you', mine: true, epic: 'broker', branch: '#1284', sub: '2/3' },
  { id: 'CAP-151', title: 'Port allocator avoids TOCTOU race', type: 'bug', points: 2, status: 'progress', who: 'you', mine: true, epic: 'broker', branch: '#1276' },
  { id: 'CAP-139', title: 'Capability scope cache', type: 'feature', points: 3, status: 'review', who: 'you', mine: true, epic: 'broker', branch: '#1283' },
  { id: 'CAP-160', title: 'Session-tree token aggregation', type: 'feature', points: 5, status: 'testing', who: 'you', mine: true, epic: 'sessions', sub: '4/4' },
  { id: 'CAP-148', title: 'Broker: immutable grants once issued', type: 'feature', points: 5, status: 'todo', who: 'mara', epic: 'broker' },
  { id: 'CAP-153', title: 'Session resume from store', type: 'feature', points: 8, status: 'todo', who: 'kai', epic: 'sessions' },
  { id: 'CAP-155', title: 'Provider registry hot-reload', type: 'feature', points: 5, status: 'todo', who: 'you', mine: true, epic: 'sessions' },
  { id: 'CAP-149', title: 'Datasource: prod read-only guard', type: 'feature', points: 3, status: 'review', who: 'lea', epic: 'sessions', branch: '#1271' },
  { id: 'CAP-150', title: 'Flaky test: broker escalation', type: 'bug', points: 1, status: 'testing', who: 'jdev', epic: 'broker' },
  { id: 'CAP-131', title: 'Terminal: renameable tabs', type: 'feature', points: 2, status: 'done', who: 'you', mine: true, epic: 'shell' },
  { id: 'CAP-128', title: 'Activity bar drag-and-dock', type: 'feature', points: 3, status: 'done', who: 'mara', epic: 'shell' },
  { id: 'CAP-126', title: 'Diff view: split / unified', type: 'feature', points: 5, status: 'done', who: 'you', mine: true, epic: 'shell' },
  { id: 'CAP-162', title: 'Worktree GC on crash', type: 'chore', points: 3, status: 'backlog', who: '—', epic: 'broker' },
  { id: 'CAP-164', title: 'Telemetry opt-in screen', type: 'feature', points: 5, status: 'backlog', who: '—', epic: 'shell' },
];
const TICKET_EPICS = [
  { id: 'broker', label: 'Worktree & Capability Broker' },
  { id: 'sessions', label: 'Sessions & Providers' },
  { id: 'shell', label: 'IDE Shell' },
];
const TICKET_COLUMNS = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'To do' },
  { id: 'progress', label: 'In Progress' },
  { id: 'review', label: 'Review' },
  { id: 'testing', label: 'Testing' },
  { id: 'done', label: 'Done' },
];
// Burndown: remaining story points per sprint day (idx 0..10). null = future.
const BURNDOWN = {
  ideal:   [52, 46.8, 41.6, 36.4, 31.2, 26, 20.8, 15.6, 10.4, 5.2, 0],
  team:    [52, 50, 47, 44, 41, 36, 33, null, null, null, null],
  // private: just your committed points (18 total)
  myIdeal: [18, 16.2, 14.4, 12.6, 10.8, 9, 7.2, 5.4, 3.6, 1.8, 0],
  mine:    [18, 18, 15, 13, 11, 8, 6, null, null, null, null],
};

// ---- Tasks dashboard extras (WIP, reviews, throughput) ----
const TEAM_WIP = [
  { who: 'you', wip: 2, limit: 3 },
  { who: 'mara', wip: 1, limit: 3 },
  { who: 'kai', wip: 1, limit: 3 },
  { who: 'jdev', wip: 1, limit: 2 },
  { who: 'lea', wip: 1, limit: 3 },
];
// per sprint day (idx 0..6 so far)
const MY_WIP_SERIES = [1, 2, 2, 3, 2, 2, 2];
const REVIEWS_GIVEN = [1, 0, 2, 1, 3, 1, 2];
const THROUGHPUT = [0, 1, 1, 2, 1, 3, 2];   // tickets closed / day
const TASK_TYPE_SPLIT = [
  { label: 'Feature', value: 9, color: 'var(--accent)' },
  { label: 'Bug', value: 3, color: 'var(--error)' },
  { label: 'Chore', value: 2, color: 'var(--text-tertiary)' },
];

// ---- File diff (side-by-side), sample for worktree.ts ----
const DIFF = {
  file: 'src/core/worktree.ts', added: 8, removed: 1,
  rows: [
    { l: { n: 16, t: '  async dispose() {' }, r: { n: 16, t: '  async dispose() {' }, k: 'ctx' },
    { l: { n: 17, t: '    this.watcher.close();' }, r: { n: 17, t: '    this.watcher.close();' }, k: 'ctx' },
    { l: null, r: { n: 18, t: '    await this.teardown();' }, k: 'add' },
    { l: { n: 18, t: '  }' }, r: { n: 19, t: '  }' }, k: 'ctx' },
    { l: null, r: { n: 20, t: '' }, k: 'add' },
    { l: null, r: { n: 21, t: '  async teardown() {' }, k: 'add' },
    { l: null, r: { n: 22, t: '    await this.broker.release(this.port);' }, k: 'add' },
    { l: { n: 19, t: '    // TODO: free the port' }, r: null, k: 'del' },
    { l: null, r: { n: 23, t: '    await rm(this.dir, { recursive: true });' }, k: 'add' },
    { l: null, r: { n: 24, t: '  }' }, k: 'add' },
    { l: { n: 20, t: '}' }, r: { n: 25, t: '}' }, k: 'ctx' },
  ],
};

// ---- Changes vs a base branch (branch comparison) ----
// ---- Changes vs a base branch (branch comparison) ----
// The current branch (feat/worktree-teardown) already has an open PR (#1284),
// so the default base is its PR TARGET. Without a PR it'd be the PARENT it
// branched from. Any other branch is selectable via the searchable dropdown.
const CHANGES_HAS_PR = true;
const COMPARE_BRANCHES = [
  { id: 'develop', name: 'develop', role: 'target' },   // PR target
  { id: 'main', name: 'main', role: 'parent' },          // branched from
  { id: 'release/1.4', name: 'release/1.4' },
  { id: 'release/1.3', name: 'release/1.3' },
  { id: 'feat/session-resume', name: 'feat/session-resume' },
  { id: 'feat/capability-cache', name: 'feat/capability-cache' },
  { id: 'fix/port-allocator', name: 'fix/port-allocator' },
  { id: 'chore/ci-cache', name: 'chore/ci-cache' },
];
const CHANGESET = [
  { ext: 'ts', name: 'worktree.ts', path: 'src/core', git: 'M', add: 12, del: 4 },
  { ext: 'ts', name: 'broker.ts', path: 'src/core', git: 'A', add: 96, del: 0 },
  { ext: 'ts', name: 'session-tree.ts', path: 'src/core', git: 'M', add: 24, del: 8 },
  { ext: 'rs', name: 'main.rs', path: 'src-tauri', git: 'M', add: 6, del: 2 },
  { ext: 'json', name: 'package.json', path: '.', git: 'M', add: 2, del: 1 },
];

// ---- Team awareness (git.live-style): who is working where ----
const AWARENESS = [
  { who: 'mara', branch: 'feat/capability-cache', pr: '#1283', act: 'editing broker.ts', when: '2m ago', files: ['broker.ts', 'registry.ts'], status: 'active', overlap: 'broker.ts' },
  { who: 'jdev', branch: 'perf/broker-grant', pr: '#1279', act: 'pushed 3 commits', when: '18m ago', files: ['broker.ts'], status: 'active', overlap: 'broker.ts' },
  { who: 'kai', branch: 'feat/session-resume', pr: '#1280', act: 'opened a PR', when: '1h ago', files: ['session-tree.ts'], status: 'idle' },
  { who: 'lea', branch: 'refactor/session-store', pr: '#1255', act: 'left 2 comments', when: '3h ago', files: ['session-store.ts'], status: 'idle' },
];

Object.assign(window, { Icon, FileIcon, PROJECTS, SCRATCH, TABS, CHANGE_GROUPS, SHELF, SESSIONS, ALERTS, INSPECTIONS, PRS, GIT_STATS, SEARCH, STRUCTURE, DATASOURCES, GIT_WEEKS, GIT_SERIES, GIT_DORA, PR_CATEGORIES, WORK_HEATMAP, CONTAINER_GROUPS, SPRINT, TICKETS, TICKET_COLUMNS, TICKET_EPICS, BURNDOWN, CHANGES_HAS_PR, TEAM_WIP, MY_WIP_SERIES, REVIEWS_GIVEN, THROUGHPUT, TASK_TYPE_SPLIT, TASKS, DIFF, GIT_PRS, LABEL_COLORS, COMPARE_BRANCHES, CHANGESET, AWARENESS });
