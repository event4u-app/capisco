/**
 * Sidecar entrypoint (B0). Boots a headless JSON-RPC/NDJSON sidecar on a unix
 * socket with the deterministic mock providers registered. The deferred
 * Rust/Tauri shell would spawn this binary and pass the socket path; here it is
 * driven by the TS-IPC harness and the integration tests.
 *
 * Socket path resolution (deterministic, overridable):
 *   1. `--socket <path>` arg
 *   2. `CAPISCO_SIDECAR_SOCKET` env
 *   3. `<os.tmpdir>/capisco-sidecar.sock`
 */

import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { Sidecar } from "./server/sidecar.ts";
import type { ProviderRegistry } from "./registry/registry.ts";
import type { Broker } from "./broker/capability-broker.ts";
import { registerMockProviders } from "./register-mocks.ts";
import { registerBroker } from "./register-broker.ts";
import { registerSession } from "./register-session.ts";
import { PendingPermissionRegistry } from "./acp/pending-permission-registry.ts";
import { createLiveAgentProvider } from "./acp/live-agent-provider.ts";
import { readRealAcpEnv } from "./acp/real-acp-config.ts";
import { PROVIDER_IDS } from "./register-mocks.ts";
import { FileTelemetryStore } from "./telemetry/telemetry-store.ts";
import { registerQuality } from "./register-quality.ts";
import { registerTaskForge } from "./register-task-forge.ts";
import { registerSentry } from "./register-sentry.ts";
import { registerProvision } from "./register-provision.ts";
import { BackendSelection } from "./acp/backend-selection.ts";
import { registerLsp } from "./register-lsp.ts";
import { registerTerminal } from "./register-terminal.ts";
import { createSecretStore } from "./broker/create-secret-store.ts";
import type { SecretStore } from "@/contracts";
import { createFileRecentProjects } from "./recent/recent-projects.ts";

export function resolveSocketPath(argv: string[] = process.argv.slice(2)): string {
  const flag = argv.indexOf("--socket");
  if (flag !== -1 && argv[flag + 1]) return argv[flag + 1];
  if (process.env.CAPISCO_SIDECAR_SOCKET) return process.env.CAPISCO_SIDECAR_SOCKET;
  return join(tmpdir(), "capisco-sidecar.sock");
}

/**
 * The machine-wide Recent-Projects registry file (overview §6). Lives in
 * user-config, shared by every Capisco instance on the host. Override with
 * `CAPISCO_RECENT_FILE` (tests point it at a temp path).
 */
export function resolveRecentFilePath(): string {
  if (process.env.CAPISCO_RECENT_FILE) return process.env.CAPISCO_RECENT_FILE;
  return join(homedir(), ".config", "capisco", "recent-projects.json");
}

/**
 * Register the full provider stack onto a registry (broker chokepoint + session
 * + quality + task-forge + the deterministic mocks). Shared by the unix-socket
 * sidecar boot and the dev WebSocket bridge — both front the identical registry.
 * The Recent-Projects provider is the real **file-backed** machine-wide
 * registry; every other provider is its deterministic mock (real adapters are a
 * thin swap behind the same contract).
 */
export interface RegisterAllProvidersOptions {
  /**
   * Swap the deterministic mock `agent` IPC provider for the LIVE one over the
   * real session store + pending-permission registry. The dev WebSocket bridge
   * sets this (it is the runnable live path where a real agent run is approved
   * from the UI). The unix-socket sidecar leaves it `false` so its `agent`
   * provider stays the deterministic mock — the ipc-integration parity proof and
   * its mock subscribe→done stream are a load-bearing contract that must not
   * regress (mirrors how the real git/fs swap is dev-bridge-only).
   */
  liveAgent?: boolean;
  /**
   * Persistent secret vault (road-to-real-breadth P0). The caller builds it
   * async (`createSecretStore()` → keychain on macOS, else 0600 file) and passes
   * it here so tokens survive restarts. Omitted → InMemorySecretStore (tests).
   */
  secrets?: SecretStore;
}

export function registerAllProviders(
  registry: ProviderRegistry,
  opts: RegisterAllProvidersOptions = {},
): Broker {
  const recent = createFileRecentProjects({ filePath: resolveRecentFilePath() });
  registerMockProviders(registry, recent);
  // IDE self-telemetry (P3): the REAL file-backed store, strict opt-in (disabled
  // by default), scrubbed, local-only. A first-party fs primitive like
  // recent-projects — holds no SecretStore, so it cannot leak the vault.
  registry.register(PROVIDER_IDS.telemetry, new FileTelemetryStore() as never);
  // The capability broker — the un-bypassable execution chokepoint (B4). Booted
  // with the conservative human-authored default allowlist and NO production
  // datasources (production is human-confirmed config, never inferred). B3 (ACP)
  // wires behind this so the agent can never act around it.
  const broker = registerBroker(registry, { secrets: opts.secrets });
  // B3 — the persistent session store + ToDo→Agent micro-north-star, wired
  // BEHIND the broker so every agent capability still flows through the
  // chokepoint. The LIVE pending-permission registry is the UI human-in-the-loop
  // gate: an agent `ask` parks for the UI and awaits its `resolvePermission` IPC
  // decision (fail-closed on a bounded timeout / no client). The resolver is
  // wired on every surface; the live `agent` IPC provider swap (so the UI's
  // `getPendingPermission`/`resolvePermission` reach the awaiting resolver) is
  // dev-bridge-only (`liveAgent`) so the unix sidecar's mock-data contract holds.
  const pending = new PendingPermissionRegistry();
  // Agent backend selection (road-to-agent-backend-enablement P1). Default is the
  // deterministic in-repo `acp` stub (mock/test parity, byte-identical goldens);
  // `CAPISCO_AGENT_BACKEND=native` selects the ClaudeCodeProvider stream-json
  // adapter, which drives the user's existing `claude` login (no raw key). The
  // same `backend` is what Phase 2's interactive chat run reuses.
  const backend = process.env.CAPISCO_AGENT_BACKEND === "native" ? ("native" as const) : undefined;
  const { store } = registerSession(registry, broker, { pending, backend });

  // B8 — backend detection (moved up so the runtime selection can read it). The
  // install action is broker-gated; detection is read-only on the host.
  const { provider: provision } = registerProvision(registry, { broker });

  // P2 — runtime agent-backend selection. The UI's picker drives this (detect →
  // select), the composer bar shows `current()` (the REAL backend, not the mock
  // "API"), and `cost()` turns real token telemetry into USD.
  const selection = new BackendSelection(
    { detect: () => provision.detect() },
    backend === "native" ? "claude-native" : undefined,
  );
  registry.register("agent-backend", {
    detect: () => selection.detect(),
    select: async (id: string) => {
      selection.select(id);
      return selection.current();
    },
    current: () => Promise.resolve(selection.current()),
    cost: (model: string, telemetry: import("@/contracts").Telemetry) =>
      Promise.resolve(selection.cost(model, telemetry)),
  } as never);

  if (opts.liveAgent) {
    // P2 — the interactive chat run. The broker is the side-effect chokepoint;
    // the runtime `selection` resolves the spawn (acp-bridge → real
    // claude-code-acp); `acp` env is the fallback (stub by default). Permission
    // asks park for the UI (`pending`).
    registry.replace(
      PROVIDER_IDS.agent,
      createLiveAgentProvider({ store, pending, broker, acp: readRealAcpEnv(), selection }) as never,
    );
  }
  // B5 — the quality-tool runner (eslint/tsc/vitest) + deferred AI-review fake.
  // Grounds the AI in real, parsed tool facts; folds diagnostics onto the
  // shared signal rail. No external dependency (binaries are first-party).
  registerQuality(registry);
  // P5 — real language intelligence (completion/hover/diagnostics) per
  // (root × language). Lazy spawn via the P1 supervisor; degrades to empty when
  // the language server is not installed.
  registerLsp(registry);
  // P6 — real terminal: a shell PTY per tab (node-pty) through the P1 supervisor.
  // open/write/resize/close + a data/exit subscription; working dir = worktree.
  registerTerminal(registry);
  // B6 — read-only Task (Jira/Linear) + Forge (GitHub/GitLab) providers from
  // recorded fixtures: "my tickets / next from sprint / whose turn". The
  // ticket→worktree→status lifecycle is constructed in-process by the consumer
  // (its external status write is broker-gated, not RPC-fired). Live tokens +
  // bidirectional sync deferred.
  registerTaskForge(registry);
  // P0 — read-only Sentry provider from recorded fixtures: issues / crons /
  // performance stats / alert rules. Live API tokens + write surface (resolve /
  // ignore / assign) deferred.
  registerSentry(registry);
  // B8 — backend detection (read-only `which`/`--version` probe) + broker-gated
  // install. `provision.detect` returns the structured agent-backend catalog so
  // the AgentSettings UI can offer a low-friction install/use flow. The install
  // action flows through the broker chokepoint; the default human gate is
  // fail-closed (deny-all) — a real UI swaps in a confirm-the-exact-command
  // prompt. Detection is real on the host; nothing auto-installs.
  // (registerProvision moved up — the runtime backend selection reads it.)
  // The broker is returned so the dev-workspace swap can wire the broker-gated
  // editor-save adapter (P2) behind the same `projectFs` id.
  return broker;
}

/**
 * Construct a sidecar with all providers registered (not yet listening).
 */
export function createSidecar(socketPath: string, opts: RegisterAllProvidersOptions = {}): Sidecar {
  const sidecar = new Sidecar({ socketPath });
  registerAllProviders(sidecar.registry, opts);
  return sidecar;
}

export async function main(): Promise<Sidecar> {
  const socketPath = resolveSocketPath();
  // Persistent secret vault (P0): keychain on macOS, else 0600 file. Built async,
  // then injected so tokens survive restarts.
  const secrets = await createSecretStore();
  const sidecar = createSidecar(socketPath, { secrets });
  await sidecar.listen();
  console.error(`[capisco-sidecar] listening on ${sidecar.address()}`);
  const shutdown = (): void => {
    void sidecar.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return sidecar;
}

// Run when invoked directly (node sidecar/main.ts), not when imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
