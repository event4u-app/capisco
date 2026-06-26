/**
 * Deterministic-fake provider wiring (B0). Registers the existing UI mock
 * providers — the same `contracts/` implementations the browser shell uses — as
 * the sidecar's providers. This is the headless integration-test substrate and
 * the "real where verifiable, fake where external" default: the mocks resolve
 * deterministically (no Date.now / Math.random), so the full IPC spine (client
 * proxy → socket → registry → provider → event stream) is exercised end-to-end
 * without any external dependency. Real adapters (real git, real ACP) are a thin
 * swap behind the same registry ids.
 */

import {
  fakeRuntimeProvider,
  mockAgentProvider,
  mockEditorProvider,
  mockGitProvider,
  mockIngestProvider,
  mockProjectFsProvider,
  mockRevertProvider,
  mockRecentProjects,
  mockShadowStore,
  mockSignalProvider,
  mockTasksProvider,
  mockWorkspaceProvider,
} from "@/mocks";
import type { RecentProjectsProvider } from "@/contracts";
import type { ProviderRegistry } from "./registry/registry.ts";

/** Stable provider ids — the qualified-method prefix on the wire. */
export const PROVIDER_IDS = {
  agent: "agent",
  workspace: "workspace",
  editor: "editor",
  git: "git",
  tasks: "tasks",
  signal: "signal",
  history: "history",
  recent: "recent",
  runtime: "runtime",
  projectFs: "projectFs",
  ingest: "ingest",
  revert: "revert",
  telemetry: "telemetry",
} as const;

/**
 * Register every deterministic mock provider on a registry. `recent` accepts an
 * override so a real deployment can swap the in-memory mock for the file-backed
 * machine-wide registry (`createFileRecentProjects`) behind the same contract.
 */
export function registerMockProviders(
  registry: ProviderRegistry,
  recent: RecentProjectsProvider = mockRecentProjects,
): void {
  registry.register(PROVIDER_IDS.agent, mockAgentProvider as never);
  registry.register(PROVIDER_IDS.workspace, mockWorkspaceProvider as never);
  registry.register(PROVIDER_IDS.editor, mockEditorProvider as never);
  registry.register(PROVIDER_IDS.git, mockGitProvider as never);
  registry.register(PROVIDER_IDS.tasks, mockTasksProvider as never);
  registry.register(PROVIDER_IDS.signal, mockSignalProvider as never);
  registry.register(PROVIDER_IDS.history, mockShadowStore as never);
  registry.register(PROVIDER_IDS.recent, recent as never);
  // P1 — the project file-tree + content provider. Default boot is the
  // deterministic mock (browser/visual parity); the dev bridge swaps in the
  // real fs+git provider for an opened repo behind the same id.
  registry.register(PROVIDER_IDS.projectFs, mockProjectFsProvider as never);
  // FakeRuntimeProvider feeds the Services view (B2). Only `listServices` is
  // RPC-able over the wire (subscribeStats is out-of-band streaming, ports() a
  // local allocator); the registry routes the flat method, the in-process
  // consumer reaches the full provider directly.
  registry.register(PROVIDER_IDS.runtime, fakeRuntimeProvider as never);
  // P2 — context-file ingestion. Default boot is the screening mock (browser /
  // test parity); the dev bridge swaps in the broker-gated BrokerIngestor for
  // the real `+`-Add / Drag&Drop chokepoint behind the same id.
  registry.register(PROVIDER_IDS.ingest, mockIngestProvider as never);
  // P4 — code-hunk revert. Default boot is the deterministic mock; the dev
  // bridge swaps in the broker-gated, git-authoritative BrokerReverter.
  registry.register(PROVIDER_IDS.revert, mockRevertProvider as never);
}
