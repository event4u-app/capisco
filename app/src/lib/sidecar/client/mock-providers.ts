/**
 * The in-process mock {@link ProviderBundle} (B0 fallback). The browser-only
 * Vite app uses this — the same deterministic mocks the UI has always consumed,
 * now assembled into the bundle shape the desktop seam selects against. This is
 * the "browser stub stays as fallback" half of the acceptance criterion.
 *
 * Browser-safe: imports only the mocks (pure data + contracts), no `node:net`.
 */

import {
  mockAgentProvider,
  mockEditorProvider,
  mockGitProvider,
  mockProjectFsProvider,
  mockRecentProjects,
  mockSessionStore,
  mockShadowStore,
  mockSignalProvider,
  mockTasksProvider,
  mockTodoProvider,
  mockWorkspaceProvider,
  mockWorktreeProvider,
} from "@/mocks";
import type { ProviderBundle } from "./providers.ts";

export function createMockProviders(): ProviderBundle {
  return {
    agent: mockAgentProvider,
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
  };
}
