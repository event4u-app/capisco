import { useSyncExternalStore } from "react";
import { isDesktop, subscribeBridge } from "@/lib/desktop-shell";

/**
 * Reactively tracks whether the desktop sidecar bridge is present. The dev
 * bridge installs asynchronously after boot (`connectDevBridge`), so a component
 * that only read `isDesktop()` at mount would render the browser/mock label
 * forever. Subscribing here re-renders the consumer the moment the bridge wires
 * in (or clears), so effects keyed on it re-run against the real sidecar (C4).
 */
export function useBridgeReady(): boolean {
  return useSyncExternalStore(
    subscribeBridge,
    () => isDesktop(),
    () => false, // SSR / no-DOM snapshot: no bridge.
  );
}
