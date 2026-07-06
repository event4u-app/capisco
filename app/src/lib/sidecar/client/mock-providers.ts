/**
 * The in-process mock {@link ProviderBundle} (B0 fallback). The browser-only
 * Vite app uses this — the same deterministic mocks the UI has always consumed,
 * now assembled into the bundle shape the desktop seam selects against. This is
 * the "browser stub stays as fallback" half of the acceptance criterion.
 *
 * Browser-safe: imports only the mocks (pure data + contracts), no `node:net`.
 */

import {
  agentSnapshot,
  mockAgentProvider,
  mockEditorProvider,
  mockGitProvider,
  mockIngestProvider,
  mockProjectFsProvider,
  mockQualityProvider,
  mockRecentProjects,
  mockRevertProvider,
  mockSentryProvider,
  mockSessionStore,
  mockShadowStore,
  mockSignalProvider,
  mockTasksProvider,
  mockTerminalProvider,
  mockTodoProvider,
  mockWorkspaceProvider,
  mockWorktreeProvider,
} from "@/mocks";
import type { AgentBackendProvider, LspProvider } from "@/contracts";
import type { ProviderBundle } from "./providers.ts";

/** Browser-mode LSP mock — no language server in the browser; empty + deterministic. */
const mockLsp: LspProvider = {
  available: () => Promise.resolve(false),
  open: () => Promise.resolve(),
  completion: () => Promise.resolve([]),
  hover: () => Promise.resolve(null),
  definition: () => Promise.resolve([]),
  references: () => Promise.resolve([]),
  rename: () => Promise.resolve({ changes: [] }),
  documentSymbol: () => Promise.resolve([]),
  inlayHints: () => Promise.resolve([]),
  foldingRanges: () => Promise.resolve([]),
};

/**
 * Deterministic browser-mode agent-backend mock. `current()` reuses the existing
 * mockAgentProvider.getBackend() and `cost()` returns the long-standing mock
 * "$0.04" so the browser path + pixel goldens stay byte-identical; the REAL
 * detect/select/current/cost live in the sidecar (BackendSelection).
 */
const mockAgentBackend: AgentBackendProvider = {
  // The full deterministic catalog (same list the picker read statically before
  // P1) — now delivered THROUGH `detect()`, so the picker is provider-driven in
  // the browser exactly as it is on desktop. The real host scan replaces this.
  detect: () => Promise.resolve(agentSnapshot.backends),
  select: () => mockAgentProvider.getBackend(),
  current: () => mockAgentProvider.getBackend(),
  cost: () => Promise.resolve(0.04),
};

export function createMockProviders(): ProviderBundle {
  return {
    agent: mockAgentProvider,
    agentBackend: mockAgentBackend,
    lsp: mockLsp,
    terminal: mockTerminalProvider,
    quality: mockQualityProvider,
    workspace: mockWorkspaceProvider,
    editor: mockEditorProvider,
    git: mockGitProvider,
    tasks: mockTasksProvider,
    signal: mockSignalProvider,
    history: mockShadowStore,
    recent: mockRecentProjects,
    projectFs: mockProjectFsProvider,
    worktree: mockWorktreeProvider,
    session: mockSessionStore,
    todo: mockTodoProvider,
    ingest: mockIngestProvider,
    revert: mockRevertProvider,
    sentry: mockSentryProvider,
  };
}
