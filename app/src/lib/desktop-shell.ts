/**
 * DesktopShell seam (B0). Selects the provider implementation the UI runs
 * against, at runtime, with zero knowledge in any UI consumer:
 *
 *  - **Desktop** — when a host bridge has injected `globalThis.__CAPISCO_SIDECAR__`
 *    (a {@link Transport} the Rust/Tauri shell pipes the sidecar unix socket
 *    through), the providers are IPC proxies over a {@link SidecarClient}. This
 *    is the mock→real swap point.
 *  - **Browser** — no bridge → the in-process deterministic mocks
 *    (`createMockProviders`). The Vite-only app stays fully functional offline.
 *
 * Browser-safe by construction: the bridge supplies a ready `Transport` object,
 * so this module (and everything it imports) never references `node:net`. The
 * desktop host owns the actual socket; the webview only sees a byte pipe.
 */

import type { Transport } from "@/lib/sidecar/protocol/transport";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client";
import { createIpcProviders, type ProviderBundle } from "@/lib/sidecar/client/providers";
import { createMockProviders } from "@/lib/sidecar/client/mock-providers";

/** The shape a desktop host injects to bridge the sidecar socket to the webview. */
export interface SidecarBridge {
  /** A duplex byte transport already connected to the sidecar process. */
  transport: Transport;
}

/** Whether a desktop sidecar bridge is present in this runtime. */
export function isDesktop(): boolean {
  return typeof getBridge() !== "undefined";
}

function getBridge(): SidecarBridge | undefined {
  return (globalThis as { __CAPISCO_SIDECAR__?: SidecarBridge }).__CAPISCO_SIDECAR__;
}

/**
 * Resolve the active provider bundle. Desktop → IPC proxies over the bridged
 * sidecar; browser → mocks. Memoised so repeated calls share one client.
 */
let cached: ProviderBundle | null = null;

export function getProviders(): ProviderBundle {
  if (cached) return cached;
  const bridge = getBridge();
  cached = bridge ? createIpcProviders(new SidecarClient(bridge.transport)) : createMockProviders();
  return cached;
}

/** Test/desktop hook: install a bridge transport and reset the memoised bundle. */
export function installSidecarBridge(transport: Transport): void {
  (globalThis as { __CAPISCO_SIDECAR__?: SidecarBridge }).__CAPISCO_SIDECAR__ = { transport };
  cached = null;
}

/** Test hook: clear any installed bridge and reset to the browser fallback. */
export function clearSidecarBridge(): void {
  delete (globalThis as { __CAPISCO_SIDECAR__?: SidecarBridge }).__CAPISCO_SIDECAR__;
  cached = null;
}
