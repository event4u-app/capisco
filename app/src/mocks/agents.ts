import type {
  AgentBackend,
  AgentOption,
  AgentProvider,
  BackendConfig,
  EffortLevel,
  GrantAxis,
  Message,
  PermissionDecision,
  PermissionRequest,
  PlanUsageRow,
  Session,
  SessionEvent,
  SessionListener,
  SessionNode,
  SessionTree,
  SystemContextSize,
  Telemetry,
  ToolAction,
  TranscriptBlock,
  Unsubscribe,
} from "@/contracts";

// Deterministic seed (no Date.now / Math.random) → stable golden captures.

const AGENTS: AgentOption[] = [
  { id: "Opus 4.8", label: "Opus 4.8" },
  { id: "Sonnet 4.8", label: "Sonnet 4.8" },
  { id: "Haiku 4.8", label: "Haiku 4.8" },
  { id: "GPT-5", label: "GPT-5" },
  { id: "Local", label: "Local" },
];

const EFFORT_LEVELS: EffortLevel[] = [
  { id: 0, label: "Minimal" },
  { id: 1, label: "Low" },
  { id: 2, label: "Medium" },
  { id: 3, label: "High" },
  { id: 4, label: "Higher" },
  { id: 5, label: "Max" },
];

const PLAN_USAGE: PlanUsageRow[] = [
  { id: "5h", label: "5-hour limit", detail: "0%", pct: 0, tone: "tertiary" },
  {
    id: "weekly",
    label: "Weekly · all models",
    detail: "resets Jun 19 · 93%",
    pct: 93,
    tone: "warning",
  },
  { id: "sonnet", label: "Sonnet only", detail: "resets Jun 19 · 8%", pct: 8, tone: "accent" },
  {
    id: "credits",
    label: "Usage credits",
    detail: "$1,735.15 of $2,000.00",
    pct: 87,
    tone: "warning",
  },
];

// Deterministic system-context size (P5): the loaded rules/guidelines char
// count + limit the composer's rules-warning reads. The real backend sums the
// actually-assembled context; this is the browser/test twin.
const SYSTEM_CONTEXT: SystemContextSize = { chars: 277988, limit: 99024 };

// Deterministic long transcript for the virtualization gate (build-spec §4 /
// Tischstakes): 500 alternating messages, no Date.now / Math.random.
const LONG_BLOCKS: TranscriptBlock[] = Array.from({ length: 500 }, (_, i): TranscriptBlock => {
  const role = i % 2 === 0 ? "user" : "agent";
  const body =
    role === "user"
      ? `Step ${i + 1}: inspect the next module and report its public surface.`
      : `Acknowledged (turn ${i + 1}). Reading the module and summarising its exported symbols.`;
  return { type: "message", block: { id: `s4-m${i + 1}`, role, body } };
});

// Structured telemetry helpers (Phase 1) — replaces pre-rendered meta strings.
function tel(tokensIn: number, tokensOut: number, runtimeMs: number): Telemetry {
  return { tokensIn, tokensOut, runtimeMs };
}

/** Roll a node's own telemetry up with every subagent's (parent ← subagent). */
export function aggregateTelemetry(
  own: Telemetry,
  subs: { telemetry: Telemetry }[],
): Telemetry {
  return subs.reduce(
    (acc, s) => ({
      tokensIn: acc.tokensIn + s.telemetry.tokensIn,
      tokensOut: acc.tokensOut + s.telemetry.tokensOut,
      runtimeMs: Math.max(acc.runtimeMs, s.telemetry.runtimeMs),
    }),
    own,
  );
}

const SESSIONS: Session[] = [
  {
    id: "s1",
    model: "Claude",
    status: "running",
    title: "Implement worktree teardown",
    // Parent own-telemetry; the subagent's tokens aggregate up (see below).
    telemetry: aggregateTelemetry(tel(0, 6500, 169_000), [{ telemetry: tel(0, 1200, 31_000) }]),
    subs: [
      {
        // A circumscribed "write tests" subtask — origin-routed to the SMALL
        // tier (Haiku) to showcase model-routing P3: the badge per session-tree
        // node shows WHICH model does WHICH task (parent Opus, subtask Haiku).
        id: "s1a",
        model: "Haiku 4.8",
        status: "running",
        title: "Subagent · write tests",
        telemetry: tel(0, 1200, 31_000),
      },
    ],
  },
  {
    id: "s2",
    model: "GPT-5",
    status: "idle",
    title: "Refactor broker grant model",
    telemetry: tel(0, 18_000, 0),
  },
  {
    id: "s3",
    model: "Local",
    status: "waiting",
    title: 'Search: "where is port allocated?"',
    telemetry: tel(0, 0, 0),
  },
  {
    id: "s4",
    model: "Claude",
    status: "running",
    title: "Audit module surfaces",
    telemetry: tel(0, 41_000, 242_000),
  },
];

const BLOCKS: Record<string, TranscriptBlock[]> = {
  s1: [
    {
      type: "message",
      block: {
        id: "s1-m1",
        role: "user",
        body: "Tear down the worktree when a session ends, and free its allocated port.",
      },
    },
    {
      type: "message",
      block: {
        id: "s1-m2",
        role: "agent",
        body: "I'll add a `teardown()` to `Worktree` and call it from `SessionTree.dispose()`. First, the edit:",
      },
    },
    {
      type: "tool",
      block: {
        id: "s1-t1",
        kind: "Edit",
        target: "src/core/worktree.ts",
        added: 12,
        removed: 4,
        openTarget: "worktree.ts",
        // Rich diff rows (design-sync-v2 §3): the +/− sign + line number render
        // in the gutter, so the text carries only the code (no leading marker).
        diff: [
          { kind: "ctx", text: "  this.watcher.close();", lineNo: 15 },
          { kind: "del", text: "  // TODO: free port", lineNo: 16 },
          { kind: "add", text: "  async teardown() {", lineNo: 16 },
          { kind: "add", text: "    await this.broker.release(this.port);", lineNo: 17 },
          { kind: "add", text: "    await rm(this.dir, { recursive: true });", lineNo: 18 },
          { kind: "ctx", text: "  }", lineNo: 19 },
        ],
      },
    },
    {
      type: "message",
      block: { id: "s1-m3", role: "agent", body: "Now removing the temp worktree directory:" },
    },
    {
      type: "permission",
      block: {
        id: "s1-p1",
        command: "Bash(rm -rf .worktrees/tmp)",
        label: "Approval required",
        scopes: ["Allow once", "This session", "Deny"],
      },
    },
    {
      type: "message",
      block: {
        id: "s1-m4",
        role: "agent",
        body: "All checks pass after the change:",
        table: {
          head: ["Check", "Status"],
          rows: [
            [{ text: "task check-compression" }, { text: "✓ no errors", tone: "ok" }],
            [{ text: "task sync-check-hashes" }, { text: "✓ clean", tone: "ok" }],
            [{ text: "task lint-skills" }, { text: "✓ 440 pass · 0 fail", tone: "ok" }],
          ],
        },
      },
    },
  ],
  s2: [
    {
      type: "message",
      block: {
        id: "s2-m1",
        role: "user",
        body: "Refactor the broker so grants are immutable once issued.",
      },
    },
    {
      type: "message",
      block: {
        id: "s2-m2",
        role: "agent",
        who: "GPT-5",
        body: "Plan: freeze the `Grant` record on issue and route revocations through a `tombstone` set. Want me to keep the existing `Map` API?",
      },
    },
    {
      type: "message",
      block: {
        id: "s2-m3",
        role: "user",
        body: "Yes, keep the API. Session is idle until you confirm.",
      },
    },
    {
      type: "message",
      block: {
        id: "s2-m4",
        role: "agent",
        who: "GPT-5",
        body: "Readiness scorecard for the grant-model refactor:",
        table: {
          scorecard: true,
          head: ["Area", "Before", "After", "Δ"],
          rows: [
            [
              { text: "Immutable grants" },
              { text: "2 / 10", tone: "bad" },
              { text: "10 / 10", tone: "ok" },
              { text: "+8", tone: "ok" },
            ],
            [
              { text: "Revocation via tombstone" },
              { text: "0 / 10", tone: "bad" },
              { text: "10 / 10", tone: "ok" },
              { text: "+10", tone: "ok" },
            ],
            [
              { text: "API compatibility" },
              { text: "5 / 10", tone: "bad" },
              { text: "10 / 10", tone: "ok" },
              { text: "+5", tone: "ok" },
            ],
            [
              { text: "Test coverage" },
              { text: "1 / 10", tone: "bad" },
              { text: "10 / 10", tone: "ok" },
              { text: "+9", tone: "ok" },
            ],
            [
              { text: "Broker audit log" },
              { text: "6 / 10", tone: "warn" },
              { text: "9 / 10", tone: "ok" },
              { text: "+3", tone: "ok" },
            ],
          ],
          foot: [
            { text: "Total" },
            { text: "14 / 50", tone: "bad" },
            { text: "49 / 50", tone: "ok" },
            { text: "+35", tone: "ok" },
          ],
        },
        cards: [
          { k: "Before", v: "14/50", s: "mutable grants · no tombstone", tone: "bad" },
          { k: "After", v: "49/50", s: "frozen records · API kept", tone: "ok" },
          { k: "Tests added", v: "+312", s: "broker · grant · tombstone" },
        ],
      },
    },
  ],
  s3: [
    {
      type: "message",
      block: { id: "s3-m1", role: "user", body: "Where is the port allocated for a worktree?" },
    },
    {
      type: "message",
      block: {
        id: "s3-m2",
        role: "agent",
        who: "Local",
        body: "Searching the workspace for `allocatePort` and `this.port` …",
      },
    },
    {
      type: "tool",
      block: {
        id: "s3-t1",
        kind: "Search",
        target: '"where is port allocated?" · 7 hits',
        openTarget: "worktree.ts",
      },
    },
    {
      type: "permission",
      block: {
        id: "s3-p1",
        command: "Read(src/core/**, *.ts)",
        label: "Approval required",
        scopes: ["Once", "This session", "Deny"],
        // A secret-bearing read shows the credential as a reference, never a
        // value (invariant §3.2 / Overview §2.1).
        credentialRef: "staging-admin",
        // This read is derived from an untrusted search result → hard gate (§3.3).
        fromUntrusted: true,
      },
    },
  ],
  s4: LONG_BLOCKS,
};

function pendingBlock(id: string): PermissionRequest | undefined {
  return (BLOCKS[id] ?? []).find(
    (b): b is Extract<TranscriptBlock, { type: "permission" }> => b.type === "permission",
  )?.block;
}

const PENDING: Record<string, PermissionRequest | undefined> = {
  s1: pendingBlock("s1"),
  s3: pendingBlock("s3"),
};

function messagesOf(id: string): Message[] {
  return (BLOCKS[id] ?? [])
    .filter((b): b is Extract<TranscriptBlock, { type: "message" }> => b.type === "message")
    .map((b) => b.block);
}

function toolsOf(id: string): ToolAction[] {
  return (BLOCKS[id] ?? [])
    .filter((b): b is Extract<TranscriptBlock, { type: "tool" }> => b.type === "tool")
    .map((b) => b.block);
}

/**
 * Build a linear session tree from a flat block list (§2.2). Each block is a
 * node chained to the previous; the active leaf is the tail. Retry branches are
 * grafted later by `branch()` as siblings — never overwriting the parent.
 */
function buildTree(id: string): SessionTree {
  const blocks = BLOCKS[id] ?? [];
  const nodes: Record<string, SessionNode> = {};
  const roots: string[] = [];
  let prev: string | null = null;
  for (const block of blocks) {
    const nodeId = block.block.id;
    nodes[nodeId] = { id: nodeId, parentId: prev, block, children: [] };
    if (prev) nodes[prev].children.push(nodeId);
    else roots.push(nodeId);
    prev = nodeId;
  }
  return { nodes, roots, activeLeaf: prev ?? "" };
}

// Live, in-memory session trees so retry-branches persist across reads.
const TREES: Record<string, SessionTree> = {};
function treeOf(id: string): SessionTree {
  return (TREES[id] ??= buildTree(id));
}

let branchSeq = 0;
let mockMsgSeq = 0;
/**
 * Live subscribers per session (P5 — browser dev chat). `subscribe` registers a
 * listener here; `sendPrompt` appends a deterministic turn to {@link BLOCKS} and
 * notifies them so the transcript re-fetches `getBlocks` and the run settles —
 * turning the browser/dev chat from a dead no-op into a responsive mock.
 */
const liveListeners = new Map<string, Set<SessionListener>>();

/**
 * Broker grant store (§3 return channel). `resolvePermission` records the human
 * decision per its axis. A `deny` is recorded as `deny`; an `once` is NOT
 * persisted beyond the call. There is no path to record a forever-grant — the
 * `GrantAxis` type has no such value, so it is structurally unconstructable.
 */
const GRANTS = new Map<string, GrantAxis>();
export function grantOf(sessionId: string, requestId: string): GrantAxis | undefined {
  return GRANTS.get(`${sessionId}:${requestId}`);
}

const BACKEND: BackendConfig = { kind: "api", provider: "Anthropic · Claude" };
const DETECTED_CLI: BackendConfig = {
  kind: "cli",
  provider: "claude 1.4.2",
  detail: "/usr/local/bin/claude",
};

/**
 * Deterministic agent-backend catalog (B8 P3) — the structured `AgentBackend[]`
 * the AgentSettings backend picker renders in the browser/stub default. On the
 * desktop sidecar the real `provision.detect` replaces this; here it is a fixed
 * snapshot so the mock/visual harness stays byte-identical (no real host probe,
 * no `which` call). The Stub backend is the always-ready default so CI and the
 * Playwright goldens never need a real agent. The native + bridge backends show
 * the install/guide affordances without performing any install.
 */
const BACKEND_CATALOG: AgentBackend[] = [
  {
    id: "stub",
    label: "Stub Agent",
    driver: "prerequisite",
    status: "ready",
    detail: "deterministic · no key",
  },
  {
    id: "claude-native",
    label: "Claude Code (native)",
    driver: "native-stream-json",
    status: "guide",
    guideUrl: "https://docs.claude.com/en/docs/claude-code/overview",
    requires: ["claude"],
  },
  {
    id: "claude-code-acp",
    label: "Claude Code (via ACP)",
    driver: "acp-bridge",
    status: "installable",
    installCommand: ["npm", "i", "-g", "@zed-industries/claude-code-acp"],
    requires: ["npm", "claude"],
  },
  {
    id: "codex",
    label: "Codex (via ACP)",
    driver: "acp-bridge",
    status: "guide",
    guideUrl: "https://docs.claude.com/en/docs/claude-code/overview",
    requires: ["codex"],
  },
];

/** The default selected backend id — the deterministic stub (CI/goldens-safe). */
const DEFAULT_BACKEND_ID = "stub";

/**
 * Deterministic event sequence for a session's live stream (§ Phase 0). Tokens
 * stream the last agent message in two deltas, then a telemetry update, then
 * `done`. Pure data — the subscribe loop replays it synchronously so tests are
 * deterministic and nothing is polled.
 */
function eventScript(id: string): SessionEvent[] {
  const session = SESSIONS.find((s) => s.id === id);
  if (!session) return [{ type: "done" }];
  const lastAgent = [...messagesOf(id)].reverse().find((m) => m.role === "agent");
  const events: SessionEvent[] = [{ type: "status", status: session.status }];
  if (lastAgent) {
    const mid = lastAgent.id;
    const half = Math.ceil(lastAgent.body.length / 2);
    events.push({ type: "token", messageId: mid, delta: lastAgent.body.slice(0, half) });
    events.push({ type: "token", messageId: mid, delta: lastAgent.body.slice(half) });
  }
  const pending = PENDING[id];
  if (pending) events.push({ type: "permission", request: pending });
  events.push({ type: "telemetry", telemetry: session.telemetry });
  events.push({ type: "done" });
  return events;
}

export const mockAgentProvider: AgentProvider = {
  listSessions: () => Promise.resolve(SESSIONS),
  getBlocks: (id) => Promise.resolve(BLOCKS[id] ?? []),
  getTree: (id) => Promise.resolve(treeOf(id)),
  branch: (id, nodeId, label) => {
    const tree = treeOf(id);
    const parent = tree.nodes[nodeId];
    if (!parent) return Promise.resolve(tree.activeLeaf);
    const newId = `${id}-b${++branchSeq}`;
    tree.nodes[newId] = {
      id: newId,
      parentId: nodeId,
      // A retry branch re-issues the parent's block as a fresh sibling head.
      block: parent.block,
      children: [],
      branchLabel: label ?? `retry ${parent.children.length + 1}`,
    };
    parent.children.push(newId);
    tree.activeLeaf = newId;
    return Promise.resolve(newId);
  },
  getTranscript: (id) => Promise.resolve(messagesOf(id)),
  getToolActions: (id) => Promise.resolve(toolsOf(id)),
  getPendingPermission: (id) => Promise.resolve(PENDING[id] ?? null),
  resolvePermission: (sessionId, requestId, decision: PermissionDecision) => {
    // Persist per axis. `once` is single-shot (not stored); everything else is
    // recorded. A forever-grant is unconstructable — no such GrantAxis exists.
    const recorded: GrantAxis = decision.axis;
    if (recorded !== "once") GRANTS.set(`${sessionId}:${requestId}`, recorded);
    return Promise.resolve(recorded);
  },
  subscribe: (id, listener: SessionListener): Unsubscribe => {
    let live = true;
    // Register for live pushes (sendPrompt notifies these — P5).
    let set = liveListeners.get(id);
    if (!set) {
      set = new Set();
      liveListeners.set(id, set);
    }
    set.add(listener);
    // Replay the deterministic script on a microtask so subscribers can attach
    // before the first event; cancellable via the returned unsubscribe.
    void Promise.resolve().then(() => {
      for (const event of eventScript(id)) {
        if (!live) return;
        listener(event);
      }
    });
    return () => {
      live = false;
      set?.delete(listener);
    };
  },
  getBackend: () => Promise.resolve(BACKEND),
  listAgents: () => Promise.resolve(AGENTS),
  listEffortLevels: () => Promise.resolve(EFFORT_LEVELS),
  getPlanUsage: () => Promise.resolve(PLAN_USAGE),
  getDetectedCli: () => Promise.resolve(DETECTED_CLI),
  getSystemContextSize: () => Promise.resolve(SYSTEM_CONTEXT),
  /**
   * Browser/dev mock turn (P5). No real agent here, so we deterministically
   * echo: append the user's message + a canned agent reply to the session's
   * blocks, then notify live subscribers (the transcript re-fetches `getBlocks`)
   * and signal `done` (the caller settles the run → no fake infinite spinner).
   * The reply is explicitly labelled a mock so it is never mistaken for a real
   * agent run — that runs on the native backend.
   */
  sendPrompt: (id, prompt) => {
    const blocks = BLOCKS[id] ?? (BLOCKS[id] = []);
    const userId = `mock-u${++mockMsgSeq}`;
    const agentId = `mock-a${++mockMsgSeq}`;
    blocks.push({ type: "message", block: { id: userId, role: "user", body: prompt } });
    blocks.push({
      type: "message",
      block: {
        id: agentId,
        role: "agent",
        body: `Mock reply — acknowledged: "${prompt.slice(0, 120)}". This is the browser dev mock; the real agent runs on the selected native backend.`,
      },
    });
    const set = liveListeners.get(id);
    if (set) for (const l of set) l({ type: "done" });
    return Promise.resolve();
  },
};

// Synchronous deterministic snapshots for render-only consumers (the async
// methods above are the contract seam; these are the same data resolved
// instantly so SNAPSHOT views paint on the first frame without polling).
export const agentSnapshot = {
  sessions: SESSIONS,
  agents: AGENTS,
  effortLevels: EFFORT_LEVELS,
  planUsage: PLAN_USAGE,
  backend: BACKEND,
  detectedCli: DETECTED_CLI,
  backends: BACKEND_CATALOG,
  defaultBackendId: DEFAULT_BACKEND_ID,
  systemContext: SYSTEM_CONTEXT,
  blocks: (id: string): TranscriptBlock[] => BLOCKS[id] ?? [],
};
