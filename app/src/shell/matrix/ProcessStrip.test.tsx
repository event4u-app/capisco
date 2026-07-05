/**
 * ProcessStrip (agent-matrix P0). Renders the supervisor health snapshot as
 * process rows, marks restarts, and releases its subscription on unmount.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import type { SupervisorProvider } from "@/contracts";
import { mockSupervisorProvider } from "@/mocks";
import { ProcessStrip } from "./ProcessStrip";

function renderStrip(provider: SupervisorProvider = mockSupervisorProvider) {
  return render(
    <ThemeProvider>
      <ProcessStrip provider={provider} />
    </ThemeProvider>,
  );
}

describe("ProcessStrip", () => {
  it("renders a row per supervised process", async () => {
    renderStrip();
    await waitFor(() => expect(screen.getByTestId("process-strip")).toBeInTheDocument());
    expect(screen.getByTestId("process-pty:term-1")).toBeInTheDocument();
    expect(screen.getByTestId("process-agent:s1")).toBeInTheDocument();
    expect(screen.getByTestId("process-dap:php:9003")).toHaveAttribute("data-state", "exited");
  });

  it("marks processes that have restarted", async () => {
    renderStrip();
    await waitFor(() => expect(screen.getByTestId("process-strip")).toBeInTheDocument());
    expect(screen.getByTestId("process-restarts-lsp:php:/repo")).toHaveTextContent("2");
    // A zero-restart process shows no restart marker.
    expect(screen.queryByTestId("process-restarts-pty:term-1")).not.toBeInTheDocument();
  });

  it("renders nothing when there are no processes", () => {
    const empty: SupervisorProvider = {
      health: () => Promise.resolve([]),
      subscribe: () => () => {},
    };
    renderStrip(empty);
    expect(screen.queryByTestId("process-strip")).not.toBeInTheDocument();
  });

  it("null-cost: releases its subscription on unmount", () => {
    let active = 0;
    const counting: SupervisorProvider = {
      health: () => mockSupervisorProvider.health(),
      subscribe: (l) => {
        active++;
        const unsub = mockSupervisorProvider.subscribe(l);
        return () => {
          active--;
          unsub();
        };
      },
    };
    const { unmount } = renderStrip(counting);
    expect(active).toBe(1);
    unmount();
    expect(active).toBe(0);
  });
});
