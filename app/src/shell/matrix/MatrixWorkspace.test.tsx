/**
 * MatrixWorkspace (P0) — render + the null-cost invariant as a MECHANISM.
 *
 * The null-cost test is the frontend leak detector: mount the Matrix with a
 * subscription-counting provider, confirm it subscribes, unmount, and assert the
 * count is back to zero. This proves the subscribe-on-show / unsubscribe-on-hide
 * contract (the React effect cleanup path) fires — the sidecar-side IPC counter
 * is Class-B and tracked separately on the real-runtime track.
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import type { AgentProvider } from "@/contracts";
import { mockAgentProvider } from "@/mocks";
import { MatrixWorkspace } from "./MatrixWorkspace";

/** Wrap a provider and count currently-active session subscriptions. Spread
 * copies every method; only `subscribe` is instrumented. */
function countingProvider(inner: AgentProvider) {
  const state = { active: 0, peak: 0 };
  const provider: AgentProvider = {
    ...inner,
    subscribe(sessionId, listener) {
      state.active++;
      state.peak = Math.max(state.peak, state.active);
      const unsub = inner.subscribe(sessionId, listener);
      return () => {
        state.active--;
        unsub();
      };
    },
  };
  return { provider, state };
}

function renderMatrix(props?: { provider?: AgentProvider; nodeLimit?: number }) {
  return render(
    <ThemeProvider>
      <div style={{ height: 800 }}>
        <MatrixWorkspace {...props} />
      </div>
    </ThemeProvider>,
  );
}

describe("MatrixWorkspace", () => {
  it("renders the session/subagent graph from the mock stream", async () => {
    renderMatrix();
    await waitFor(() => expect(screen.getByTestId("matrix-graph")).toBeInTheDocument());
    // At least the first mock session appears as a node.
    const sessions = await mockAgentProvider.listSessions();
    expect(screen.getByTestId(`matrix-node-${sessions[0].id}`)).toBeInTheDocument();
  });

  it("degrades to the tree view above the node budget", async () => {
    renderMatrix({ nodeLimit: 1 }); // mock has >1 node → forces the fallback
    await waitFor(() => expect(screen.getByTestId("matrix-tree-fallback")).toBeInTheDocument());
    expect(screen.queryByTestId("matrix-graph")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no sessions", async () => {
    const empty: AgentProvider = {
      ...mockAgentProvider,
      listSessions: () => Promise.resolve([]),
    };
    renderMatrix({ provider: empty });
    await waitFor(() => expect(screen.getByTestId("matrix-empty")).toBeInTheDocument());
  });

  it("null-cost: subscribes on show and releases every subscription on hide", async () => {
    const { provider, state } = countingProvider(mockAgentProvider);
    const { unmount } = renderMatrix({ provider });
    await waitFor(() => expect(state.peak).toBeGreaterThan(0)); // subscribed on show
    unmount();
    expect(state.active).toBe(0); // released on hide — no leaked subscription
  });
});
