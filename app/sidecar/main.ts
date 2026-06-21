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
import { registerQuality } from "./register-quality.ts";
import { registerTaskForge } from "./register-task-forge.ts";
import { registerProvision } from "./register-provision.ts";
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
export function registerAllProviders(registry: ProviderRegistry): Broker {
  const recent = createFileRecentProjects({ filePath: resolveRecentFilePath() });
  registerMockProviders(registry, recent);
  // The capability broker — the un-bypassable execution chokepoint (B4). Booted
  // with the conservative human-authored default allowlist and NO production
  // datasources (production is human-confirmed config, never inferred). B3 (ACP)
  // wires behind this so the agent can never act around it.
  const broker = registerBroker(registry);
  // B3 — the persistent session store + ToDo→Agent micro-north-star, wired
  // BEHIND the broker so every agent capability still flows through the
  // chokepoint. Default human gate is fail-closed (a real UI swaps in a prompt).
  registerSession(registry, broker);
  // B5 — the quality-tool runner (eslint/tsc/vitest) + deferred AI-review fake.
  // Grounds the AI in real, parsed tool facts; folds diagnostics onto the
  // shared signal rail. No external dependency (binaries are first-party).
  registerQuality(registry);
  // B6 — read-only Task (Jira/Linear) + Forge (GitHub/GitLab) providers from
  // recorded fixtures: "my tickets / next from sprint / whose turn". The
  // ticket→worktree→status lifecycle is constructed in-process by the consumer
  // (its external status write is broker-gated, not RPC-fired). Live tokens +
  // bidirectional sync deferred.
  registerTaskForge(registry);
  // B8 — backend detection (read-only `which`/`--version` probe) + broker-gated
  // install. `provision.detect` returns the structured agent-backend catalog so
  // the AgentSettings UI can offer a low-friction install/use flow. The install
  // action flows through the broker chokepoint; the default human gate is
  // fail-closed (deny-all) — a real UI swaps in a confirm-the-exact-command
  // prompt. Detection is real on the host; nothing auto-installs.
  registerProvision(registry, { broker });
  // The broker is returned so the dev-workspace swap can wire the broker-gated
  // editor-save adapter (P2) behind the same `projectFs` id.
  return broker;
}

/**
 * Construct a sidecar with all providers registered (not yet listening).
 */
export function createSidecar(socketPath: string): Sidecar {
  const sidecar = new Sidecar({ socketPath });
  registerAllProviders(sidecar.registry);
  return sidecar;
}

export async function main(): Promise<Sidecar> {
  const socketPath = resolveSocketPath();
  const sidecar = createSidecar(socketPath);
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
