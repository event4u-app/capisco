import type { Session, TranscriptBlock } from "@/contracts";

// Deterministic chat seed (no Date.now / Math.random) — the Chat workspace is
// the SAME component as Agents (Design-Sync P3), but a quick assistant chat:
// no subagents, no tool actions, no permission prompts. Just messages.

const CHAT_SESSIONS: Session[] = [
  {
    id: "c1",
    model: "Sonnet",
    status: "idle",
    title: "Broker prompting rules",
    telemetry: { tokensIn: 0, tokensOut: 38_000, runtimeMs: 0 },
  },
  {
    id: "c2",
    model: "Sonnet",
    status: "idle",
    title: "Explain the session tree",
    telemetry: { tokensIn: 0, tokensOut: 12_000, runtimeMs: 0 },
  },
];

const CHAT_BLOCKS: Record<string, TranscriptBlock[]> = {
  c1: [
    {
      type: "message",
      block: {
        id: "c1-m1",
        role: "user",
        body: "How does the capability broker decide when to prompt me?",
      },
    },
    {
      type: "message",
      block: {
        id: "c1-m2",
        role: "agent",
        body: "It checks the requested `(principal, capability, scope)` against existing grants. A cached `session` grant passes silently; anything broader — or a `production` datasource, or a secret — always escalates to a prompt.",
      },
    },
    {
      type: "message",
      block: {
        id: "c1-m3",
        role: "user",
        body: "Can I pre-approve read-only shell for this session?",
      },
    },
    {
      type: "message",
      block: {
        id: "c1-m4",
        role: "agent",
        body: "Yes — grant `Bash(read-only)` at `session` scope from the next prompt. Writes and network still escalate per-command.",
      },
    },
  ],
  c2: [
    {
      type: "message",
      block: { id: "c2-m1", role: "user", body: "Explain the session-tree in one paragraph." },
    },
    {
      type: "message",
      block: {
        id: "c2-m2",
        role: "agent",
        body: "A session is one model thread. Subagents are child sessions that share the parent's worktree-workspace, so they see the same files and grants but run their own context. The tree lets you fan out work and still review it in one place.",
      },
    },
  ],
};

/** Synchronous deterministic snapshot for the Chat workspace (mirrors
 * `agentSnapshot` shape so the shared component reads either by `kind`). */
export const chatSnapshot = {
  sessions: CHAT_SESSIONS,
  blocks: (id: string): TranscriptBlock[] => CHAT_BLOCKS[id] ?? [],
};
