/**
 * useBridgeReady — the reactive bridge signal behind the C4 fix.
 *
 * The dev bridge installs asynchronously after boot, so a one-shot `isDesktop()`
 * read at mount would leave the composer bar on the browser/mock label forever.
 * This proves the hook re-renders its consumer when the bridge installs and again
 * when it clears.
 */

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Transport } from "@/lib/sidecar/protocol/transport";
import { clearSidecarBridge, installSidecarBridge } from "@/lib/desktop-shell";
import { useBridgeReady } from "@/lib/use-bridge";

// useBridgeReady only reads presence (`isDesktop()`), never opens the transport,
// so a no-op stub is enough to flip the global bridge flag.
const fakeTransport = {
  send: () => {},
  onMessage: () => () => {},
  close: () => {},
} as unknown as Transport;

function Probe() {
  return <span data-testid="bridge">{useBridgeReady() ? "desktop" : "browser"}</span>;
}

afterEach(() => {
  clearSidecarBridge();
});

describe("useBridgeReady", () => {
  it("is 'browser' with no bridge, flips to 'desktop' on install, back on clear", () => {
    render(<Probe />);
    expect(screen.getByTestId("bridge")).toHaveTextContent("browser");

    act(() => installSidecarBridge(fakeTransport));
    expect(screen.getByTestId("bridge")).toHaveTextContent("desktop");

    act(() => clearSidecarBridge());
    expect(screen.getByTestId("bridge")).toHaveTextContent("browser");
  });
});
