import { afterEach, describe, expect, it } from "vitest";
import type { RecentProject } from "@/contracts";
import { createInMemoryRecentProjects } from "@/mocks";
import { createPipePair } from "@/lib/sidecar/protocol/transport.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { createIpcProviders } from "@/lib/sidecar/client/providers.ts";
import { ProviderRegistry } from "../registry/registry.ts";
import { IpcConnection } from "../server/ipc-server.ts";
import { registerMockProviders } from "../register-mocks.ts";

function wire(recentSeed?: RecentProject[]) {
  const { a, b } = createPipePair();
  const registry = new ProviderRegistry();
  registerMockProviders(
    registry,
    createInMemoryRecentProjects(recentSeed),
  );
  new IpcConnection(b, registry);
  const client = new SidecarClient(a);
  return { providers: createIpcProviders(client), client };
}

describe("Recent-Projects over IPC", () => {
  let closer: (() => void) | null = null;
  afterEach(() => closer?.());

  it("lists recent projects through the provider bundle", async () => {
    const { providers, client } = wire();
    closer = () => client.close();
    const list = await providers.recent.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("path");
    expect(list[0]).toHaveProperty("instanceId");
  });

  it("touch round-trips and surfaces in a subsequent list (most-recent-first)", async () => {
    const { providers, client } = wire([]);
    closer = () => client.close();
    await providers.recent.touch({ path: "/work/alpha", instanceId: "w1", branch: "main" });
    await providers.recent.touch({ path: "/work/beta", instanceId: "w2" });
    const list = await providers.recent.list();
    expect(list.map((p) => p.path)).toEqual(["/work/beta", "/work/alpha"]);
    expect(list.find((p) => p.path === "/work/alpha")?.branch).toBe("main");
  });

  it("release over IPC marks an instance inactive", async () => {
    const { providers, client } = wire([]);
    closer = () => client.close();
    await providers.recent.touch({ path: "/work/a", instanceId: "w1" });
    const cleared = await providers.recent.release("w1");
    expect(cleared).toBe(1);
    const list = await providers.recent.list();
    expect(list[0].active).toBe(false);
  });
});
