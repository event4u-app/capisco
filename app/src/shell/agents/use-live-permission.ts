import * as React from "react";

import type { PermissionDecision, PermissionRequest, SessionEvent } from "@/contracts";
import { getProviders, isDesktop } from "@/lib/desktop-shell";

/**
 * LIVE human-in-the-loop permission hook (the UI half of the gate this wiring
 * closes). When a real sidecar bridge is connected, it surfaces the ACTIVE
 * session's parked `ask` — driven by the agent provider's event stream
 * (`subscribe` pushes a `permission` event the instant a gate parks), with a
 * short poll of `getPendingPermission` as a fallback while a run is active. The
 * returned `resolve` maps a chosen scope label to a {@link PermissionDecision}
 * and calls the `resolvePermission` IPC for `(sessionId, requestId)`.
 *
 * MOCK / SNAPSHOT PATH UNTOUCHED: with no bridge (`isDesktop()` false — vitest +
 * Playwright visual), the hook is inert and returns `pending: null`, so the
 * Transcript renders exactly as before and the goldens stay byte-identical. Only
 * the bridge-connected path becomes interactive.
 */

const POLL_INTERVAL_MS = 800;

/** Map a PermissionPrompt scope label to the broker decision axis. */
export function scopeToDecision(scope: string): PermissionDecision {
  const s = scope.toLowerCase();
  if (s.includes("session")) return { axis: "session" };
  if (s.includes("deny")) return { axis: "deny" };
  // "Allow once" / "Once" / anything else → single-call only (fail-narrow).
  return { axis: "once" };
}

export interface LivePermission {
  /** The active session's parked `ask`, or null (none parked / no live bridge). */
  pending: PermissionRequest | null;
  /** Resolve the parked `ask` with the chosen scope → decision over IPC. */
  resolve: (scope: string) => void;
}

export function useLivePermission(sessionId: string): LivePermission {
  const [pending, setPending] = React.useState<PermissionRequest | null>(null);
  // Track the resolving request id so a stale poll cannot resurrect a cleared
  // prompt after the user has acted on it.
  const resolvingRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // No bridge → inert. `pending` is already null (initial state); never touch
    // state synchronously in the effect body (no cascading render).
    if (!isDesktop()) return;
    const agent = getProviders().agent;
    let live = true;
    resolvingRef.current = null;

    const apply = (req: PermissionRequest | null): void => {
      if (!live) return;
      // Ignore a poll/event that re-surfaces the request the user just resolved.
      if (req && req.id === resolvingRef.current) return;
      setPending(req);
    };

    // Initial read so a gate already parked before mount shows immediately.
    void agent.getPendingPermission(sessionId).then(apply).catch(() => {});

    // Push channel: a `permission` event means a gate just parked; any other
    // event may mean the prior gate cleared — re-read the pending state.
    const off = agent.subscribe(sessionId, (event: SessionEvent) => {
      if (event.type === "permission") apply(event.request);
      else void agent.getPendingPermission(sessionId).then(apply).catch(() => {});
    });

    // Poll fallback (the subscribe stream may not carry a permission event on
    // every transport); cheap, only while this session is the active one.
    const timer = setInterval(() => {
      void agent.getPendingPermission(sessionId).then(apply).catch(() => {});
    }, POLL_INTERVAL_MS);

    return () => {
      live = false;
      off();
      clearInterval(timer);
    };
  }, [sessionId]);

  const resolve = React.useCallback(
    (scope: string) => {
      if (!isDesktop() || !pending) return;
      const decision = scopeToDecision(scope);
      const requestId = pending.id;
      resolvingRef.current = requestId;
      // Optimistically clear the prompt — the resolved gate is no longer pending.
      setPending(null);
      void getProviders()
        .agent.resolvePermission(sessionId, requestId, decision)
        .catch(() => {});
    },
    [pending, sessionId],
  );

  return { pending, resolve };
}
