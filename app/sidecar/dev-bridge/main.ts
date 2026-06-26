/**
 * Dev WebSocket bridge entrypoint (DEV-ONLY, road-to-runnable-dev P0).
 *
 * `pnpm dev` shows only mocks because no sidecar bridge is injected and the
 * sidecar speaks a unix socket the browser cannot reach. This process fronts the
 * REAL sidecar IPC over a localhost WebSocket so the Vite app talks to the live
 * sidecar — no Tauri/cargo. The Vite dev entry connects a {@link WsClientTransport}
 * and injects `globalThis.__CAPISCO_SIDECAR__`, so `getProviders()` selects the
 * real IPC proxies.
 *
 * SECURITY / SCOPE (non-negotiable):
 *  - Binds **127.0.0.1 only**. Never `0.0.0.0`. Dev-only, NOT FOR PRODUCTION.
 *  - The production transport stays the Tauri unix socket (deferred).
 *  - Every side effect still flows through the broker chokepoint + the
 *    first-party `git`/fs execution primitives; this bridge is pure transport.
 *
 * Each accepted WebSocket connection is bound to an {@link IpcConnection} over
 * the same {@link ProviderRegistry} the unix-socket sidecar fronts — identical
 * wire surface, identical providers.
 *
 * Repo selection: the bridge registers the real git + fs providers for a repo
 * root from `--repo <path>` / `CAPISCO_DEV_REPO`; with no repo configured it
 * boots mocks-only (the conservative default — the UI opens a real project at
 * runtime via the path input, which the fs provider serves per-call).
 */

import { createServer, type IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { ProviderRegistry } from "../registry/registry.ts";
import { IpcConnection } from "../server/ipc-server.ts";
import { registerAllProviders } from "../main.ts";
import { createSecretStore } from "../broker/create-secret-store.ts";
import { ghAvailable, ghRepo } from "../task-forge/gh-exec.ts";
import { createRealForgeProvider } from "../task-forge/real-forge-provider.ts";
import { createRealTaskProvider } from "../task-forge/real-task-provider.ts";
import { createRealLinearProvider } from "../task-forge/real-linear-provider.ts";
import { FORGE_PROVIDER_ID, TASK_PROVIDER_ID } from "../register-task-forge.ts";
import { createRealSentryProvider } from "../observability/real-sentry-provider.ts";
import { registerDevWorkspace } from "../register-dev-workspace.ts";
import { isWebSocketUpgrade, WsServerTransport } from "./ws-server-transport.ts";

/** The loopback host the bridge binds — never exposed beyond the machine. */
export const DEV_BRIDGE_HOST = "127.0.0.1";

export function resolveDevBridgePort(argv: string[] = process.argv.slice(2)): number {
  const flag = argv.indexOf("--port");
  if (flag !== -1 && argv[flag + 1]) return Number(argv[flag + 1]);
  if (process.env.CAPISCO_DEV_BRIDGE_PORT) return Number(process.env.CAPISCO_DEV_BRIDGE_PORT);
  return 8787;
}

/** Optional repo root to put live git + fs behind the workspace ids. */
export function resolveDevRepo(argv: string[] = process.argv.slice(2)): string | undefined {
  const flag = argv.indexOf("--repo");
  if (flag !== -1 && argv[flag + 1]) return argv[flag + 1];
  return process.env.CAPISCO_DEV_REPO || undefined;
}

export interface DevBridge {
  port: number;
  registry: ProviderRegistry;
  close(): Promise<void>;
}

/**
 * Build the dev bridge's provider registry: the full provider stack, then —
 * when a repo root is configured — the real git/fs workspace swap for it.
 */
export async function buildDevRegistry(repo?: string): Promise<ProviderRegistry> {
  const registry = new ProviderRegistry();
  // Persistent secret vault (P0): the dev instance gets the SAME real store the
  // tests prove — macOS keychain, else 0600 file — so tokens entered in the UI
  // survive a restart. Built async, injected into the broker.
  const secrets = await createSecretStore();
  // The broker is the chokepoint the editor-save write (P2) runs inside. The dev
  // bridge is the runnable LIVE path — `liveAgent` swaps the mock `agent` IPC
  // provider for the live one over the real session store + pending-permission
  // registry, so a real agent run's `ask` can be approved/denied from the UI.
  const broker = registerAllProviders(registry, { liveAgent: true, secrets });
  registerDevWorkspace(registry, { repo, broker });
  // Real GitHub forge (P0): when `gh` is authed and the checkout has a GitHub
  // remote, swap the fixture forge for the live one — the user's existing gh
  // login, no token entry. Any hiccup keeps the deterministic fixture.
  if (await ghAvailable()) {
    const ghr = await ghRepo(repo);
    if (ghr) {
      try {
        registry.replace(FORGE_PROVIDER_ID, (await createRealForgeProvider({ repo: ghr })) as never);
      } catch {
        /* keep the fixture forge on any gh error */
      }
    }
  }
  // Real Jira tasks (P0): when the base URL + email are configured (env) and a
  // `jira-token` is in the keychain, swap the fixture task provider for the live
  // one (token mode; secret-by-reference). Any error keeps the fixture.
  // Base URL + email are non-secret config: env first, else the persistent store
  // (so `task dev:web` auto-wires Jira without re-exporting env each run).
  const cfg = (k: string): string | undefined =>
    secrets.has(k) ? secrets.inject(k, (v) => v) : undefined;
  // Two TaskProvider backends share TASK_PROVIDER_ID: Jira (default) and Linear.
  // `task-backend` (env/store: "jira" | "linear") picks which one wins when both
  // are configured; absent → Jira, the original behaviour. Linear needs only a
  // `linear-token` (single SaaS endpoint, personal key — no URL/email).
  const taskBackend = (process.env.TASK_BACKEND ?? cfg("task-backend"))?.toLowerCase();
  const jiraUrl = process.env.JIRA_BASE_URL ?? cfg("jira-base-url");
  const jiraEmail = process.env.JIRA_EMAIL ?? cfg("jira-email");
  if (taskBackend === "linear" && secrets.has("linear-token")) {
    try {
      registry.replace(TASK_PROVIDER_ID, (await createRealLinearProvider({ secrets })) as never);
    } catch {
      /* keep the fixture task provider on any Linear error */
    }
  } else if (jiraUrl && jiraEmail && secrets.has("jira-token")) {
    try {
      registry.replace(
        TASK_PROVIDER_ID,
        (await createRealTaskProvider({ baseUrl: jiraUrl, email: jiraEmail, secrets })) as never,
      );
    } catch {
      /* keep the fixture task provider on any Jira error */
    }
  }
  // Real Sentry (SENTRY-BACKEND-SPEC): register the live observability provider
  // when the org (env/store) + a sentry-token (keychain) are present.
  const sentryOrg = process.env.SENTRY_ORG ?? cfg("sentry-org");
  if (sentryOrg && secrets.has("sentry-token")) {
    try {
      registry.register(
        "sentry",
        createRealSentryProvider({
          org: sentryOrg,
          secrets,
          baseUrl: process.env.SENTRY_BASE_URL ?? cfg("sentry-base-url"),
        }) as never,
      );
    } catch {
      /* no sentry provider on any error */
    }
  }
  return registry;
}

/**
 * Start the dev bridge HTTP+WS server on 127.0.0.1. Resolves once listening.
 */
export async function startDevBridge(opts: { port?: number; repo?: string } = {}): Promise<DevBridge> {
  const port = opts.port ?? resolveDevBridgePort();
  const registry = await buildDevRegistry(opts.repo);
  const transports = new Set<WsServerTransport>();

  const server = createServer((_req, res) => {
    // The bridge is a WebSocket endpoint; plain HTTP gets a terse hint.
    res.writeHead(426, { "content-type": "text/plain" });
    res.end("capisco dev sidecar bridge — connect via WebSocket (dev-only)\n");
  });

  server.on("upgrade", (req: IncomingMessage, socket: Socket) => {
    if (!isWebSocketUpgrade(req)) {
      socket.destroy();
      return;
    }
    const transport = WsServerTransport.accept(req, socket);
    // One IpcConnection per WS connection, over the shared registry. The
    // connection wires itself to the transport; the bridge tracks the transport
    // for orderly shutdown.
    new IpcConnection(transport, registry);
    transports.add(transport);
    transport.onClose(() => transports.delete(transport));
  });

  return new Promise<DevBridge>((resolve, reject) => {
    server.once("error", reject);
    // Bind loopback ONLY — never 0.0.0.0. Dev-only, not for production.
    server.listen(port, DEV_BRIDGE_HOST, () => {
      server.removeListener("error", reject);
      // Read the bound port back (port 0 → an OS-assigned ephemeral port).
      const addr = server.address();
      const boundPort = typeof addr === "object" && addr ? addr.port : port;
      resolve({
        port: boundPort,
        registry,
        close: () =>
          new Promise<void>((res) => {
            for (const t of transports) t.close();
            server.close(() => res());
            server.unref();
          }),
      });
    });
  });
}

export async function main(): Promise<DevBridge> {
  const repo = resolveDevRepo();
  const bridge = await startDevBridge({ repo });
  console.error(
    `[capisco-dev-bridge] DEV-ONLY WebSocket bridge listening on ws://${DEV_BRIDGE_HOST}:${bridge.port}` +
      (repo ? ` (repo: ${repo})` : " (mocks; open a project from the UI)"),
  );
  const shutdown = (): void => {
    void bridge.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return bridge;
}

// Run when invoked directly (node sidecar/dev-bridge/main.ts), not when imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
