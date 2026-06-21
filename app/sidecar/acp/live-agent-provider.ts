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

/** Project a persisted session record onto the UI {@link Session} shape. */
function toSession(s: StoredSession): Session {
  return { id: s.id, model: s.model, status: s.status, title: s.title, telemetry: s.telemetry };
}

export interface LiveAgentProviderOptions {
  store: SessionStore;
  pending: PendingPermissionRegistry;
}

export function createLiveAgentProvider(opts: LiveAgentProviderOptions): AgentProvider {
  const { store, pending } = opts;

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
    getBackend: (): Promise<BackendConfig> => mockAgentProvider.getBackend(),
    listAgents: (): Promise<AgentOption[]> => mockAgentProvider.listAgents(),
    listEffortLevels: (): Promise<EffortLevel[]> => mockAgentProvider.listEffortLevels(),
    getPlanUsage: (): Promise<PlanUsageRow[]> => mockAgentProvider.getPlanUsage(),
    getDetectedCli: (): Promise<BackendConfig> => mockAgentProvider.getDetectedCli(),
  };
}
