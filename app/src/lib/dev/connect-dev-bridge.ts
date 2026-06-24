/**
 * Dev-only bootstrap that connects the browser app to the REAL sidecar over the
 * localhost WebSocket bridge (road-to-runnable-dev P0).
 *
 * Without this, `pnpm dev` shows only mocks (no bridge injected, the production
 * sidecar speaks a unix socket the browser cannot reach). Here we open a
 * {@link WsClientTransport} to the dev bridge and install it via
 * {@link installSidecarBridge}, so the next {@link getProviders} call selects
 * the real IPC proxies.
 *
 * NOT FOR PRODUCTION. Guarded by `import.meta.env.DEV`; the production build
 * never bundles this path. If the bridge is unreachable (not started, or
 * disabled via `VITE_CAPISCO_DEV_BRIDGE=off`), we leave the in-process mocks in
 * place so the app still boots — degraded to mocks, never broken.
 */

import { installSidecarBridge } from "@/lib/desktop-shell";
import { WsClientTransport } from "@/lib/sidecar/client/ws-client-transport";

/** Default dev bridge URL — loopback only, mirrors the bridge's bind host. */
const DEFAULT_BRIDGE_URL = "ws://127.0.0.1:8787";

function bridgeUrl(): string {
  const env = import.meta.env.VITE_CAPISCO_DEV_BRIDGE_URL;
  return typeof env === "string" && env.length > 0 ? env : DEFAULT_BRIDGE_URL;
}

function bridgeEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_CAPISCO_DEV_BRIDGE !== "off";
}

/**
 * Attempt to connect the dev bridge. Resolves to `true` when the real sidecar
 * is wired, `false` when it falls back to mocks (disabled or unreachable).
 * Never throws — a dev convenience must not crash the app boot.
 */
export async function connectDevBridge(): Promise<boolean> {
  if (!bridgeEnabled()) return false;
  try {
    const transport = await WsClientTransport.connect(bridgeUrl());
    installSidecarBridge(transport);
    console.info(
      `[capisco] dev sidecar bridge connected (${bridgeUrl()}) — using REAL providers`,
    );
    return true;
  } catch {
    console.warn(
      `[capisco] dev sidecar bridge unreachable (${bridgeUrl()}) — falling back to mocks. ` +
        "Run `pnpm dev` (which starts the bridge) or start it with `pnpm dev:sidecar`.",
    );
    return false;
  }
}
