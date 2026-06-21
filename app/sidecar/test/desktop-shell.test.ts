import { afterEach, describe, expect, it } from "vitest";
import { createPipePair } from "@/lib/sidecar/protocol/transport.ts";
import { ProviderRegistry } from "../registry/registry.ts";
import { IpcConnection } from "../server/ipc-server.ts";
import { registerMockProviders } from "../register-mocks.ts";
import {
  clearSidecarBridge,
  getProviders,
  installSidecarBridge,
  isDesktop,
} from "@/lib/desktop-shell.ts";

afterEach(() => clearSidecarBridge());

describe("DesktopShell seam (B0 mock→real swap point)", () => {
  it("falls back to in-process mocks when no bridge is installed (browser)", async () => {
    expect(isDesktop()).toBe(false);
    const providers = getProviders();
    const sessions = await providers.agent.listSessions();
    expect(sessions.length).toBeGreaterThan(0);
  });

  it("routes through the IPC client when a bridge transport is installed (desktop)", async () => {
    // Wire an in-process pipe: server end → IpcConnection, client end → bridge.
    const { a: clientSide, b: serverSide } = createPipePair();
    const registry = new ProviderRegistry();
    registerMockProviders(registry);
    new IpcConnection(serverSide, registry);

    installSidecarBridge(clientSide);
    expect(isDesktop()).toBe(true);

    const providers = getProviders();
    const viaIpc = await providers.agent.listSessions();
    // Parity with the mock the server is backed by.
    const { mockAgentProvider } = await import("@/mocks");
    expect(viaIpc).toEqual(await mockAgentProvider.listSessions());
  });

  it("memoises the bundle within a runtime selection", () => {
    const first = getProviders();
    const second = getProviders();
    expect(first).toBe(second);
  });

  it("keeps pure synchronous contract lookups working over IPC (parity)", async () => {
    const { a: clientSide, b: serverSide } = createPipePair();
    const registry = new ProviderRegistry();
    registerMockProviders(registry);
    new IpcConnection(serverSide, registry);
    installSidecarBridge(clientSide);

    const { mockGitProvider, mockTasksProvider } = await import("@/mocks");
    const providers = getProviders();
    expect(providers.git.overdueThresholdDays).toBe(mockGitProvider.overdueThresholdDays);
    expect(providers.git.labelChartVar("feature")).toBe(mockGitProvider.labelChartVar("feature"));
    expect(providers.tasks.wipLimit).toBe(mockTasksProvider.wipLimit);
  });
});
