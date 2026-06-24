/**
 * IPC-backed {@link AgentProvider} (B0) — the mock→real swap point for the
 * streaming session surface. Every read becomes a `call`; `subscribe` opens an
 * IPC stream. The contract's `subscribe` returns a synchronous `Unsubscribe`,
 * while the IPC subscribe is async (it round-trips a server-side subscription
 * id), so the proxy registers the listener and kicks the async open in the
 * background, handing back an unsubscribe that works immediately and also tears
 * down the server stream once it has opened.
 */

import type {
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
  SessionTree,
  SystemContextSize,
  ToolAction,
  TranscriptBlock,
  Unsubscribe,
} from "@/contracts";
import type { SidecarClient } from "./sidecar-client.ts";

const ID = "agent";

export function createAgentProxy(client: SidecarClient): AgentProvider {
  const call = <R>(method: string, args: unknown[] = []): Promise<R> =>
    client.call<R>(ID, method, args);

  return {
    listSessions: () => call<Session[]>("listSessions"),
    getBlocks: (sessionId) => call<TranscriptBlock[]>("getBlocks", [sessionId]),
    getTree: (sessionId) => call<SessionTree>("getTree", [sessionId]),
    branch: (sessionId, nodeId, label) => call<string>("branch", [sessionId, nodeId, label]),
    getTranscript: (sessionId) => call<Message[]>("getTranscript", [sessionId]),
    getToolActions: (sessionId) => call<ToolAction[]>("getToolActions", [sessionId]),
    getPendingPermission: (sessionId) =>
      call<PermissionRequest | null>("getPendingPermission", [sessionId]),
    resolvePermission: (sessionId, requestId, decision: PermissionDecision) =>
      call<GrantAxis>("resolvePermission", [sessionId, requestId, decision]),
    subscribe(sessionId: string, listener: SessionListener): Unsubscribe {
      let teardown: (() => void) | null = null;
      let cancelled = false;
      void client
        .subscribe(ID, sessionId, (event) => listener(event as SessionEvent))
        .then((off) => {
          if (cancelled) off();
          else teardown = off;
        })
        .catch(() => {
          /* stream failed to open — nothing to tear down */
        });
      return () => {
        cancelled = true;
        if (teardown) teardown();
      };
    },
    getBackend: () => call<BackendConfig>("getBackend"),
    listAgents: () => call<AgentOption[]>("listAgents"),
    listEffortLevels: () => call<EffortLevel[]>("listEffortLevels"),
    getPlanUsage: () => call<PlanUsageRow[]>("getPlanUsage"),
    getDetectedCli: () => call<BackendConfig>("getDetectedCli"),
    getSystemContextSize: () => call<SystemContextSize>("getSystemContextSize"),
    sendPrompt: (sessionId, text) => call<void>("sendPrompt", [sessionId, text]),
  };
}
