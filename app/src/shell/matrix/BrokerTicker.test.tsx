/**
 * BrokerTicker (agent-matrix P0) — the read-only broker-decision strip +
 * audit-viewer. Covers: renders recent decisions, the credentialRef is shown as
 * a NAME (never a value), expand shows the full trail, live appends prepend, and
 * the null-cost unsubscribe on unmount.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import type { AuditStore } from "@/contracts";
import { createMockAuditStore, mockAuditStore } from "@/mocks";
import { BrokerTicker } from "./BrokerTicker";

function renderTicker(store: AuditStore = mockAuditStore, max?: number) {
  return render(
    <ThemeProvider>
      <BrokerTicker store={store} max={max} />
    </ThemeProvider>,
  );
}

describe("BrokerTicker", () => {
  it("renders the most-recent decisions from the store snapshot", async () => {
    renderTicker();
    await waitFor(() => expect(screen.getByTestId("broker-ticker")).toBeInTheDocument());
    // The deny + secret-read decisions are among the seeded entries.
    const rows = screen.getAllByTestId(/^broker-entry-/);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5); // capped at `max`
  });

  it("shows a secret as a credentialRef NAME, never a value", async () => {
    renderTicker();
    await waitFor(() => expect(screen.getByTestId("broker-ticker")).toBeInTheDocument());
    // Expand to guarantee the secret-read row is present.
    await userEvent.click(screen.getByTestId("broker-toggle"));
    const list = screen.getByTestId("broker-audit-list");
    expect(list).toHaveTextContent("credential: staging-admin");
    expect(list.textContent ?? "").not.toMatch(/sk-|ghp_|AKIA|password/i);
  });

  it("expands to the full audit trail and collapses again", async () => {
    const user = userEvent.setup();
    renderTicker();
    await waitFor(() => expect(screen.getByTestId("broker-ticker")).toBeInTheDocument());
    expect(screen.queryByTestId("broker-audit-list")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("broker-toggle"));
    expect(screen.getByTestId("broker-audit-list")).toBeInTheDocument();
    await user.click(screen.getByTestId("broker-toggle"));
    expect(screen.queryByTestId("broker-audit-list")).not.toBeInTheDocument();
  });

  it("prepends a live append to the ticker", async () => {
    const store = createMockAuditStore();
    renderTicker(store);
    await waitFor(() => expect(screen.getByTestId("broker-ticker")).toBeInTheDocument());
    act(() => {
      store.record({
        principalId: "agent-z",
        principalKind: "agent",
        capability: "network",
        target: "https://x.test",
        outcome: "ask",
        fromUntrusted: true,
        reason: "egress gate",
      });
    });
    await waitFor(() => expect(screen.getByTestId("broker-entry-1")).toBeInTheDocument());
  });

  it("null-cost: releases its subscription on unmount", () => {
    // Count active subscriptions via a subscribe wrapper.
    const inner = createMockAuditStore();
    let active = 0;
    const store: AuditStore = {
      record: (e) => inner.record(e),
      list: () => inner.list(),
      subscribe: (listener) => {
        active++;
        const unsub = inner.subscribe(listener);
        return () => {
          active--;
          unsub();
        };
      },
    };
    const { unmount } = renderTicker(store);
    expect(active).toBe(1); // subscribed on show
    unmount();
    expect(active).toBe(0); // released on hide — no leaked subscription
  });
});
