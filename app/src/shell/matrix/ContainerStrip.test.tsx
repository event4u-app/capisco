/**
 * ContainerStrip (agent-matrix P0 — ctop slice). Renders the runtime stats
 * stream as compact container rows, seeds from `listServices`, updates on
 * `subscribeStats`, and releases the subscription on unmount (null-cost).
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import type { RuntimeProvider } from "@/contracts";
import { fakeRuntimeProvider } from "@/mocks";
import { ContainerStrip } from "./ContainerStrip";

function renderStrip(provider: RuntimeProvider = fakeRuntimeProvider) {
  return render(
    <ThemeProvider>
      <ContainerStrip provider={provider} />
    </ThemeProvider>,
  );
}

describe("ContainerStrip", () => {
  it("renders a row per container from the runtime mock", async () => {
    renderStrip();
    await waitFor(() => expect(screen.getByTestId("container-strip")).toBeInTheDocument());
    // The deterministic mock ships web / postgres / traefik under capisco-core.
    expect(screen.getByTestId("container-web")).toBeInTheDocument();
    expect(screen.getByTestId("container-postgres")).toBeInTheDocument();
    expect(screen.getByTestId("container-web")).toHaveAttribute("data-status", "running");
  });

  it("renders nothing when there are no containers", () => {
    const empty: RuntimeProvider = {
      listServices: () => Promise.resolve([]),
      subscribeStats: () => () => {},
      ports: fakeRuntimeProvider.ports.bind(fakeRuntimeProvider),
    };
    const { container } = renderStrip(empty);
    expect(screen.queryByTestId("container-strip")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("null-cost: releases its stats subscription on unmount", () => {
    let active = 0;
    const counting: RuntimeProvider = {
      listServices: () => fakeRuntimeProvider.listServices(),
      subscribeStats: (l) => {
        active++;
        const unsub = fakeRuntimeProvider.subscribeStats(l);
        return () => {
          active--;
          unsub();
        };
      },
      ports: fakeRuntimeProvider.ports.bind(fakeRuntimeProvider),
    };
    const { unmount } = renderStrip(counting);
    expect(active).toBe(1); // subscribed on show
    unmount();
    expect(active).toBe(0); // released on hide — no leaked subscription
  });
});
