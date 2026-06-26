/**
 * The full provider bundle the UI consumes (B0 swap point). The browser shell
 * builds against `ProviderBundle`; the *implementation* is selected at runtime
 * by the {@link DesktopShell} seam (see src/lib/desktop-shell.ts):
 *
 *  - **Desktop** — a {@link SidecarClient} over a unix socket; every provider is
 *    an IPC proxy (`createIpcProviders`).
 *  - **Browser** — the in-process deterministic mocks (`createMockProviders`),
 *    the existing fallback that keeps the Vite-only app fully functional.
 *
 * Both satisfy the identical `contracts/` interfaces, so no UI consumer knows or
 * cares which side it is talking to. This module is transport-agnostic and
 * browser-safe — it never imports `node:net` (only generic proxies driven by a
 * `SidecarClient` injected from above).
 *
 * Pure synchronous contract lookups (`GitProvider.labelChartVar`,
 * `TasksProvider.epicLabel/typeChartVar`, the `*Limit`/`*ThresholdDays` consts)
 * are deterministic constants. Rather than round-trip them (they are not async
 * in the contract) or duplicate their tables (drift risk), the IPC proxy borrows
 * them verbatim from the deterministic mock provider — pure data, identical on
 * both sides by construction. A parity test pins this.
 */

import type {
  AgentBackendProvider,
  AgentProvider,
  EditorProvider,
  GitProvider,
  LspProvider,
  IngestProvider,
  ProjectFsProvider,
  RecentProjectsProvider,
  RevertProvider,
  SessionStore,
  ShadowStore,
  SignalProvider,
  TasksProvider,
  TodoProvider,
  WorkspaceProvider,
  WorktreeOpsProvider,
} from "@/contracts";
import { mockGitProvider, mockTasksProvider } from "@/mocks";
import type { SidecarClient } from "./sidecar-client.ts";
import { createAgentProxy } from "./agent-proxy.ts";

export interface ProviderBundle {
  agent: AgentProvider;
  /** Runtime agent-backend selection (P2): real detect/select/current/cost. */
  agentBackend: AgentBackendProvider;
  /** Real language intelligence (P5): completion/hover, per root × language. */
  lsp: LspProvider;
  workspace: WorkspaceProvider;
  editor: EditorProvider;
  git: GitProvider;
  tasks: TasksProvider;
  signal: SignalProvider;
  history: ShadowStore;
  recent: RecentProjectsProvider;
  /** Real on-disk project tree + file content (P1) — mock fallback in browser. */
  projectFs: ProjectFsProvider;
  /** Git-worktree primitive (P3) — real (git-backed) over the dev bridge. */
  worktree: WorktreeOpsProvider;
  /** Persistent session store (P3) — real over the dev bridge, mock in browser. */
  session: SessionStore;
  /** ToDo→agent micro-north-star (P3) — broker-gated stub session over the bridge. */
  todo: TodoProvider;
  /** Context-file ingestion (composer-context-runtime P2) — the broker-gated
   * `+`-Add / Drag&Drop chokepoint; real over the bridge, screening mock in browser. */
  ingest: IngestProvider;
  /** Code-hunk revert (composer-context-runtime P4) — broker-gated, git-authoritative
   * `checkout -- <path>`; real over the bridge, deterministic mock in browser. */
  revert: RevertProvider;
}

/**
 * Build a provider proxy: every async method becomes a `call`; the listed
 * `pureFields` (synchronous lookups / constants) are served locally and never
 * round-trip.
 */
function rpcProxy<T extends object>(
  client: SidecarClient,
  providerId: string,
  pureFields: Partial<T> = {},
): T {
  const cache = new Map<string, (...args: unknown[]) => Promise<unknown>>();
  return new Proxy(pureFields as T, {
    get(target, prop: string) {
      if (prop in target) return (target as Record<string, unknown>)[prop];
      let fn = cache.get(prop);
      if (!fn) {
        fn = (...args: unknown[]) => client.call(providerId, prop, args);
        cache.set(prop, fn);
      }
      return fn;
    },
  });
}

/** Wire every provider as an IPC proxy over a connected {@link SidecarClient}. */
export function createIpcProviders(client: SidecarClient): ProviderBundle {
  return {
    agent: createAgentProxy(client),
    agentBackend: rpcProxy<AgentBackendProvider>(client, "agent-backend"),
    lsp: rpcProxy<LspProvider>(client, "lsp"),
    workspace: rpcProxy<WorkspaceProvider>(client, "workspace"),
    editor: rpcProxy<EditorProvider>(client, "editor"),
    git: rpcProxy<GitProvider>(client, "git", {
      overdueThresholdDays: mockGitProvider.overdueThresholdDays,
      labelChartVar: mockGitProvider.labelChartVar,
    }),
    tasks: rpcProxy<TasksProvider>(client, "tasks", {
      wipLimit: mockTasksProvider.wipLimit,
      epicLabel: mockTasksProvider.epicLabel,
      typeChartVar: mockTasksProvider.typeChartVar,
    }),
    signal: rpcProxy<SignalProvider>(client, "signal"),
    history: rpcProxy<ShadowStore>(client, "history"),
    recent: rpcProxy<RecentProjectsProvider>(client, "recent"),
    projectFs: rpcProxy<ProjectFsProvider>(client, "projectFs"),
    // P3 — the worktree primitive (wire id "worktree-ops"), the session store,
    // and the ToDo provider. All async-method surfaces → pure RPC proxies.
    worktree: rpcProxy<WorktreeOpsProvider>(client, "worktree-ops"),
    session: rpcProxy<SessionStore>(client, "session"),
    todo: rpcProxy<TodoProvider>(client, "todo"),
    ingest: rpcProxy<IngestProvider>(client, "ingest"),
    revert: rpcProxy<RevertProvider>(client, "revert"),
  };
}
