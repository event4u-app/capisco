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
const putToken = vi.fn(() => Promise.resolve());
const hasToken = vi.fn(() => Promise.resolve(false));

vi.mock("@/lib/desktop-shell", () => ({
  isDesktop: () => false,
  getProviders: () => ({
    agentBackend: { detect, select, current: detect, cost: () => Promise.resolve(0) },
    credentials: { put: putToken, has: hasToken },
  }),
}));

import { AgentSettings } from "./AgentSettings";
import { AGENT_API_TOKEN_REF } from "@/contracts";

const setSelectedBackend = vi.fn();

function renderSettings(overrides: { backendKind?: "api" | "cli"; onClose?: () => void } = {}) {
  render(
    <ThemeProvider>
      <AgentSettings
        backendKind={overrides.backendKind ?? "cli"}
        setBackendKind={() => {}}
        selectedBackendId="stub"
        setSelectedBackend={setSelectedBackend}
        onClose={overrides.onClose ?? (() => {})}
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
  setSelectedBackend.mockClear();
  putToken.mockClear();
  hasToken.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe("AgentSettings — real backend detect/select (P1) + per-session pick (P3)", () => {
  it("calls detect() on mount and renders the detected backend (not the static mock)", async () => {
    renderSettings();
    await waitFor(() => expect(detect).toHaveBeenCalled());
    expect(await screen.findByTestId("agent-backend-claude-native")).toBeInTheDocument();
  });

  it("picking a backend calls the passed setter (which binds the session + selects)", async () => {
    const user = userEvent.setup();
    renderSettings();
    const useBtn = await screen.findByTestId("agent-backend-claude-native-use");
    await user.click(useBtn);
    expect(setSelectedBackend).toHaveBeenCalledWith("claude-native");
  });

  it("Redetect re-runs detect()", async () => {
    const user = userEvent.setup();
    renderSettings();
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(1));
    await user.click(screen.getByTestId("agent-settings-redetect"));
    await waitFor(() => expect(detect).toHaveBeenCalledTimes(2));
  });
});

describe("AgentSettings — API token persistence (P1 Save)", () => {
  it("Save persists the entered token to the credential vault, then closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSettings({ backendKind: "api", onClose });
    await user.type(screen.getByLabelText(/API token/i), "sk-ant-secret-123");
    await user.click(screen.getByTestId("agent-settings-save-token"));
    await waitFor(() =>
      expect(putToken).toHaveBeenCalledWith(AGENT_API_TOKEN_REF, "sk-ant-secret-123"),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("Save with an empty field stores nothing but still closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderSettings({ backendKind: "api", onClose });
    await user.click(screen.getByTestId("agent-settings-save-token"));
    expect(putToken).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("checks for a stored token on mount (presence only — never reads the value)", async () => {
    renderSettings({ backendKind: "api" });
    await waitFor(() => expect(hasToken).toHaveBeenCalledWith(AGENT_API_TOKEN_REF));
  });
});
