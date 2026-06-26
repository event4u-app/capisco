/**
 * LiveAgentProvider — the SERVER-SIDE {@link AgentProvider} that backs the IPC
 * `agent` provider for REAL, running sessions (the dev bridge / unix sidecar
 * path). The browser/mock path keeps {@link mockAgentProvider}; this is the live
 * swap behind the identical wire surface.
 *
 * It is a thin read-through over two existing primitives:
 *  - the persistent {@link SessionStore} (sessions, transcript blocks, tree), and
 *  - the {@link PendingPermissionRegistry} (the LIVE human-in-the-loop gate).
 *
 * The load-bearing methods for the permission gate are
 * {@link getPendingPermission} / {@link resolvePermission} / {@link subscribe} —
 * all delegating to the registry, so a click in the UI reaches the awaiting
 * resolver inside the live {@link AcpSession}/{@link ClaudeCodeProvider}. The
 * catalog methods (backend / agents / effort / plan-usage / detected-cli) have no
 * live source yet, so they borrow the deterministic mock provider verbatim —
 * identical data on both sides, exactly like the IPC proxy borrows the pure
 * sync constants (see lib/sidecar/client/providers.ts).
 */

import type {
  AgentProvider,
  BackendConfig,
  AgentOption,
  CapabilityBroker,
  EffortLevel,
  GrantAxis,
  Message,
  PermissionDecision,
  PermissionRequest,
  PlanUsageRow,
  Session,
  SessionListener,
  SessionTree,
  StoredSession,
  SessionStore,
  ToolAction,
  TranscriptBlock,
  Unsubscribe,
} from "@/contracts";
import { mockAgentProvider } from "@/mocks";
import type { PendingPermissionRegistry } from "./pending-permission-registry.ts";
import { AcpSession } from "./acp-session.ts";
import { type RealAcpConfig } from "./real-acp-config.ts";
import { type BackendSelection } from "./backend-selection.ts";

/** Project a persisted session record onto the UI {@link Session} shape. */
function toSession(s: StoredSession): Session {
  return { id: s.id, model: s.model, status: s.status, title: s.title, telemetry: s.telemetry };
}

/** Monotonic id for a user message block (runtime only — never in a golden). */
let userMsgSeq = 0;

export interface LiveAgentProviderOptions {
  store: SessionStore;
  pending: PendingPermissionRegistry;
  /** Broker chokepoint — every chat-run side effect flows through it (P2). */
  broker: CapabilityBroker;
  /** Real ACP CLI config (env-sourced). Absent → the deterministic stub agent. */
  acp?: RealAcpConfig;
  /** Runtime backend selection (P2). When present, the bar shows the REAL
   *  selected backend (not the mock "API") and a chat run spawns per its
   *  runConfig. Absent → the deterministic mock catalog + env-sourced acp. */
  selection?: BackendSelection;
  /** Fallback worktree cwd when a session has none yet. */
  defaultCwd?: string;
}

export function createLiveAgentProvider(opts: LiveAgentProviderOptions): AgentProvider {
  const { store, pending, broker, acp, selection, defaultCwd } = opts;

  return {
    listSessions: async (): Promise<Session[]> => {
      const stored = await store.list();
      return stored.map(toSession);
    },
    getBlocks: async (sessionId: string): Promise<TranscriptBlock[]> => {
      const session = await store.get(sessionId);
      if (!session) return [];
      const resumed = await store.resume(sessionId);
      return resumed.blocks;
    },
    getTree: async (sessionId: string): Promise<SessionTree> => {
      const session = await store.get(sessionId);
      if (!session) return { nodes: {}, roots: [], activeLeaf: "" };
      const resumed = await store.resume(sessionId);
      return resumed.tree;
    },
    branch: (sessionId, nodeId, label) => store.retryAsBranch(sessionId, nodeId, label),
    getTranscript: async (sessionId: string): Promise<Message[]> => {
      const session = await store.get(sessionId);
      if (!session) return [];
      const resumed = await store.resume(sessionId);
      return resumed.blocks
        .filter((b): b is Extract<TranscriptBlock, { type: "message" }> => b.type === "message")
        .map((b) => b.block);
    },
    getToolActions: async (sessionId: string): Promise<ToolAction[]> => {
      const session = await store.get(sessionId);
      if (!session) return [];
      const resumed = await store.resume(sessionId);
      return resumed.blocks
        .filter((b): b is Extract<TranscriptBlock, { type: "tool" }> => b.type === "tool")
        .map((b) => b.block);
    },

    // --- THE LIVE PERMISSION GATE (the gap this wiring closes) ---
    getPendingPermission: (sessionId: string): Promise<PermissionRequest | null> =>
      Promise.resolve(pending.getPendingPermission(sessionId)),
    resolvePermission: (
      sessionId: string,
      requestId: string,
      decision: PermissionDecision,
    ): Promise<GrantAxis> =>
      Promise.resolve(pending.resolvePermission(sessionId, requestId, decision)),
    subscribe: (sessionId: string, listener: SessionListener): Unsubscribe =>
      pending.subscribe(sessionId, listener),

    // --- catalog / static surface: borrowed from the deterministic mock (no
    //     live host source yet; identical data both sides) ---
    // The REAL selected backend (fixes "the bar always says API"); falls back to
    // the deterministic mock only when no runtime selection is wired.
    getBackend: (): Promise<BackendConfig> =>
      selection ? Promise.resolve(selection.current()) : mockAgentProvider.getBackend(),
    listAgents: (): Promise<AgentOption[]> => mockAgentProvider.listAgents(),
    listEffortLevels: (): Promise<EffortLevel[]> => mockAgentProvider.listEffortLevels(),
    getPlanUsage: (): Promise<PlanUsageRow[]> => mockAgentProvider.getPlanUsage(),
    getDetectedCli: (): Promise<BackendConfig> => mockAgentProvider.getDetectedCli(),
    // System-context size (P5) — the live ACP path reuses the deterministic
    // mock size until the real assembled-context sum is wired (a thin swap).
    getSystemContextSize: () => mockAgentProvider.getSystemContextSize(),

    // --- THE INTERACTIVE CHAT RUN (P2) ---
    // Append the user's turn, then drive a broker-gated agent run INTO the same
    // session. The ACP path covers the deterministic stub (default) AND the real
    // `claude-code-acp` bridge (`CAPISCO_ACP_CLI`). Permission asks park for the
    // UI via `pending.resolver` (fail-closed); the run's stream is forwarded to
    // the UI subscribers so the transcript renders the reply live. (A native
    // ClaudeCodeProvider chat adapter is a follow-up; the ACP path already gives
    // real `claude` via the bridge CLI.)
    sendPrompt: async (sessionId: string, text: string): Promise<void> => {
      const session = await store.get(sessionId);
      if (!session) return;
      await store.append(sessionId, {
        type: "message",
        block: { id: `u-${userMsgSeq++}`, role: "user", body: text },
      });
      // Nudge subscribers so the user's message renders immediately.
      pending.publish(sessionId, { type: "status", status: "running" });

      // Resolve the spawn from the runtime selection when present (acp-bridge
      // path drives a real `claude-code-acp`); else fall back to env-sourced acp
      // (stub by default, native handled by the registerSession backend).
      const rc = selection?.runConfig();
      const command = rc?.driver === "acp-bridge" ? rc.command : acp?.cliCommand;
      const args = rc?.driver === "acp-bridge" ? rc.args : acp?.cliArgs;
      const run = new AcpSession({
        broker,
        store,
        cwd: session.worktreePath || defaultCwd || process.cwd(),
        model: session.model,
        existingSessionId: sessionId,
        resolvePermission: pending.resolver,
        command,
        args,
        handshake: Boolean(command),
      });
      const unsub = run.subscribe((ev) => pending.publish(sessionId, ev));
      // Fire-and-forget: the forwarded stream drives the UI; tear the run down
      // on completion (or error). The turn is "dispatched" once we return.
      void run
        .start(text)
        .catch(() => {})
        .finally(() => {
          unsub();
          run.close();
        });
    },
  };
}
