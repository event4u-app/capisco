/**
 * AgentSettings backend picker — real detect/select wiring
 * (road-to-shell-and-chat-really-work P1).
 *
 * The picker used to be cosmetic: it rendered a static mock catalog, never called
 * the provider's `detect()`, and `onUse` only wrote a local string (never the
 * sidecar `select()`). These pin the fix: the catalog comes from `detect()` (on
 * mount + Redetect), and picking a backend drives `agentBackend.select(id)`.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { useAgents } from "./store";

const detect = vi.fn(() =>
  Promise.resolve([
    {
      id: "claude-native",
      label: "Claude Code (native)",
      driver: "native-stream-json",
      status: "ready" as const,
      detail: "/usr/local/bin/claude",
      version: "1.4.2",
    },
  ]),
);
const select = vi.fn(() => Promise.resolve({ kind: "cli" as const, provider: "Claude Code" }));

vi.mock("@/lib/desktop-shell", () => ({
  isDesktop: () => false,
  getProviders: () => ({
    agentBackend: { detect, select, current: detect, cost: () => Promise.resolve(0) },
  }),
}));

import { AgentSettings } from "./AgentSettings";

function renderSettings() {
  render(
    <ThemeProvider>
      <AgentSettings
        backendKind="cli"
        setBackendKind={() => {}}
        onClose={() => {}}
        routingEnabled={false}
        setRoutingEnabled={() => {}}
        terseEnabled={false}
        setTerseEnabled={() => {}}
        terseLevel="full"
        setTerseLevel={() => {}}
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  detect.mockClear();
  select.mockClear();
  useAgents.setState({ selectedBackendId: "stub" });
});
afterEach(() => vi.clearAllMocks());

describe("AgentSettings — real backend detect/select (P1)", () => {
  it("calls detect() on mount and renders the detected backend (not the static mock)", async () => {
    renderSettings();
    await waitFor(() => expect(detect).toHaveBeenCalled());
    expect(await screen.findByTestId("agent-backend-claude-native")).toBeInTheDocument();
  });

  it("picking a backend drives agentBackend.select(id) (was a dead local set)", async () => {
    const user = userEvent.setup();
    renderSettings();
    const useBtn = await screen.findByTestId("agent-backend-claude-native-use");
    await user.click(useBtn);
    expect(select).toHaveBeenCalledWith("claude-native");
    // …and reflects locally.
    expect(useAgents.getState().selectedBackendId).toBe("claude-native");
  });

  it("Redetect re-runs detect()", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(1));
    await user.click(screen.getByTestId("agent-settings-redetect"));
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(2));
  });
});
