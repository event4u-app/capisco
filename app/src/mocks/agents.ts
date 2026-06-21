import type {
  AgentOption,
  AgentProvider,
  BackendConfig,
  EffortLevel,
  Message,
  PermissionRequest,
  PlanUsageRow,
  Session,
  ToolAction,
  TranscriptBlock,
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

const SESSIONS: Session[] = [
  {
    id: "s1",
    model: "Claude",
    status: "running",
    title: "Implement worktree teardown",
    meta: "2m 49s · 6.5k ↓",
    subs: [
      {
        id: "s1a",
        model: "Claude",
        status: "running",
        title: "Subagent · write tests",
        meta: "0m 31s · 1.2k ↓",
      },
    ],
  },
  {
    id: "s2",
    model: "GPT-5",
    status: "idle",
    title: "Refactor broker grant model",
    meta: "idle · 18k ↓",
  },
  {
    id: "s3",
    model: "Local",
    status: "waiting",
    title: 'Search: "where is port allocated?"',
    meta: "waiting",
  },
  {
    id: "s4",
    model: "Claude",
    status: "running",
    title: "Audit module surfaces",
    meta: "4m 02s · 41k ↓",
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
        diff: [
          { kind: "add", text: "+  async teardown() {" },
          { kind: "add", text: "+    await this.broker.release(this.port);" },
          { kind: "add", text: "+    await rm(this.dir, { recursive: true });" },
          { kind: "del", text: "-    // TODO: free port" },
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
      },
    },
  ],
  s4: LONG_BLOCKS,
};

const PENDING: Record<string, PermissionRequest | undefined> = {
  s1: BLOCKS.s1.find((b): b is Extract<TranscriptBlock, { type: "permission" }> => b.type === "permission")
    ?.block,
  s3: BLOCKS.s3.find((b): b is Extract<TranscriptBlock, { type: "permission" }> => b.type === "permission")
    ?.block,
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

const BACKEND: BackendConfig = { kind: "api", provider: "Anthropic · Claude" };
const DETECTED_CLI: BackendConfig = { kind: "cli", provider: "claude 1.4.2", detail: "/usr/local/bin/claude" };

export const mockAgentProvider: AgentProvider = {
  listSessions: () => SESSIONS,
  getBlocks: (id) => BLOCKS[id] ?? [],
  getTranscript: (id) => messagesOf(id),
  getToolActions: (id) => toolsOf(id),
  getPendingPermission: (id) => PENDING[id] ?? null,
  getBackend: () => BACKEND,
  listAgents: () => AGENTS,
  listEffortLevels: () => EFFORT_LEVELS,
  getPlanUsage: () => PLAN_USAGE,
  getDetectedCli: () => DETECTED_CLI,
};
