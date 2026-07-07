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

// The dev bridge is installed ASYNCHRONOUSLY after boot (`connectDevBridge`), so
// a component that read `isDesktop()` at mount would keep the browser/mock label
// forever — the composer bar stays stale after the real sidecar wires in (C4).
// This is a tiny external store so React can subscribe (via `useSyncExternalStore`
// in `use-bridge.ts`) and re-run effects the moment the bridge appears or clears.
const bridgeListeners = new Set<() => void>();

/** Subscribe to bridge install/clear. Returns an unsubscribe. */
export function subscribeBridge(listener: () => void): () => void {
  bridgeListeners.add(listener);
  return () => bridgeListeners.delete(listener);
}

function notifyBridgeChanged(): void {
  for (const listener of bridgeListeners) listener();
}

/**
 * Resolve the active provider bundle. Desktop → IPC proxies over the bridged
 * sidecar; browser → mocks. Memoised so repeated calls share one client.
 */
let cached: ProviderBundle | null = null;

export function getProviders(): ProviderBundle {
  if (cached) return cached;
  const bridge = getBridge();
  cached = bridge
    ? createIpcProviders(new SidecarClient(bridge.transport))
    : createMockProviders();
  return cached;
}

/** Test/desktop hook: install a bridge transport and reset the memoised bundle. */
export function installSidecarBridge(transport: Transport): void {
  (globalThis as { __CAPISCO_SIDECAR__?: SidecarBridge }).__CAPISCO_SIDECAR__ = { transport };
  cached = null;
  notifyBridgeChanged();
}

/** Test hook: clear any installed bridge and reset to the browser fallback. */
export function clearSidecarBridge(): void {
  delete (globalThis as { __CAPISCO_SIDECAR__?: SidecarBridge }).__CAPISCO_SIDECAR__;
  cached = null;
  notifyBridgeChanged();
}
