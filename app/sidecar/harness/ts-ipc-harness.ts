/**
 * TS-IPC harness (B0 Phase 1) — the deferred-Rust-shell stand-in.
 *
 * The real desktop shell is a thin Rust/Tauri window that (a) loads the Vite
 * app into the OS webview and (b) spawns the sidecar process, bridging its unix
 * socket to the webview as a byte transport. That shell needs a `cargo`
 * toolchain which is not available here, so it ships as a **documented stub**
 * (see sidecar/shell-stub/README.md). This harness is its verifiable twin: it
 * stands up the exact same sidecar + provider registry behind the exact same
 * JSON-RPC/NDJSON protocol the Rust shell would speak, over an in-process pipe,
 * and hands the webview side a ready {@link SidecarBridge}-compatible transport.
 *
 * Consequence: CI never depends on a Tauri/cargo build, yet the full protocol
 * the desktop shell relies on is exercised end-to-end. Swapping the harness for
 * the real Rust bridge is a transport swap — the protocol, registry, providers,
 * and the DesktopShell seam are all unchanged.
 */

import { createPipePair } from "@/lib/sidecar/protocol/transport.ts";
import type { Transport } from "@/lib/sidecar/protocol/transport.ts";
import { ProviderRegistry } from "../registry/registry.ts";
import { IpcConnection } from "../server/ipc-server.ts";
import { registerMockProviders } from "../register-mocks.ts";
import { registerBroker } from "../register-broker.ts";
import { registerSession } from "../register-session.ts";
import { registerQuality } from "../register-quality.ts";
import { registerTaskForge } from "../register-task-forge.ts";

export interface HarnessHandle {
  /**
   * The transport the webview side installs as its {@link SidecarBridge} — the
   * same object a real Rust bridge would inject as `globalThis.__CAPISCO_SIDECAR__`.
   */
  bridgeTransport: Transport;
  /** The sidecar-side registry, for assertions/extension in tests. */
  registry: ProviderRegistry;
  /** The accepted server connection (live-subscription introspection). */
  connection: IpcConnection;
  /** Tear the harness down (closes both pipe ends + the server connection). */
  dispose(): void;
}

/**
 * Boot an in-process sidecar behind the JSON-RPC/NDJSON protocol and return a
 * bridge transport for the webview side. No OS socket, no Rust, no cargo — but
 * the same protocol, registry, providers, and connection lifecycle.
 */
export function startTsIpcHarness(): HarnessHandle {
  const { a: webviewSide, b: sidecarSide } = createPipePair();
  // Async delivery so back-to-back requests interleave like a real socket.
  (webviewSide as { deliverAsync?: boolean }).deliverAsync = true;
  (sidecarSide as { deliverAsync?: boolean }).deliverAsync = true;

  const registry = new ProviderRegistry();
  registerMockProviders(registry);
  // The deferred-Rust twin exercises the broker chokepoint too (B4).
  const broker = registerBroker(registry);
  // …and the B3 session store + ToDo→Agent spine, wired behind the broker.
  registerSession(registry, broker);
  // B5 — the quality-tool runner + deferred AI-review fake (grounds the AI in
  // real tool facts). Pure/serialisable surface; no key, no external dep.
  registerQuality(registry);
  // B6 — read-only Task/Forge fixture providers over the same protocol.
  registerTaskForge(registry);
  const connection = new IpcConnection(sidecarSide, registry);

  return {
    bridgeTransport: webviewSide,
    registry,
    connection,
    dispose() {
      webviewSide.close();
      sidecarSide.close();
    },
  };
}
