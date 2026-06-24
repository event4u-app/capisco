import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { ChatWorkspace } from "./AgentWorkspace";
import { useChat } from "./store";

function renderChat() {
  return render(
    <ThemeProvider>
      <div style={{ height: 800 }}>
        <ChatWorkspace />
      </div>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.removeItem("capisco-chat");
  useChat.setState({
    extra: [],
    closed: [],
    activeId: "c1",
    runStates: {},
    model: "Sonnet 4.8",
    effort: 3,
    backendKind: "api",
    settingsOpen: false,
  });
});

afterEach(() => {
  useChat.setState({
    extra: [],
    closed: [],
    activeId: "c1",
    runStates: {},
    settingsOpen: false,
  });
});

describe("ChatWorkspace — parameterized Agents component (Design-Sync P3)", () => {
  it("is the same component (kind=chat) with the shared session UI", () => {
    renderChat();
    const ws = screen.getByTestId("chat-workspace");
    expect(ws).toHaveAttribute("data-kind", "chat");
    // Shared UI: session tabbar, new-session, settings gear, unified composer
    // (design-sync-v2 graft — the old separate `composer-bar` is gone; the
    // controls now live in the composer's control row + below-bar).
    expect(screen.getByTestId("session-tabbar")).toBeInTheDocument();
    expect(screen.getByTestId("session-new")).toBeInTheDocument();
    expect(screen.getByTestId("session-gear")).toBeInTheDocument();
    expect(screen.getByTestId("composer-input")).toBeInTheDocument();
    expect(screen.getByTestId("composer-status")).toBeInTheDocument();
    // "Auto" is the routing control; there is no composer model dropdown
    // (token-economy definition). The model is the ModelBadge on the tab.
    expect(screen.getByTestId("composer-auto")).toBeInTheDocument();
    expect(screen.queryByTestId("composer-model")).toBeNull();
  });

  it("uses its own chat sessions + default model (Sonnet), independent of agents", () => {
    renderChat();
    expect(screen.getByTestId("session-tab-c1")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("session-tab-c1")).getByText("Broker prompting rules"),
    ).toBeInTheDocument();
    // The effective model shows as the session-tab badge, not a composer dropdown.
    expect(
      within(screen.getByTestId("session-tab-c1")).getByText("Sonnet"),
    ).toBeInTheDocument();
    // No agents sessions leaked in.
    expect(screen.queryByTestId("session-tab-s1")).toBeNull();
  });

  it("has NO subagents and NO tool actions / permission prompts (quick chat · no tools)", () => {
    renderChat();
    expect(screen.queryByTestId("subagent-row")).toBeNull();
    expect(screen.queryByTestId("tool-action")).toBeNull();
    expect(screen.queryByTestId("permission-prompt")).toBeNull();
    expect(screen.getByTestId("composer-status")).toHaveTextContent("quick chat · no tools");
    // The transcript renders plain messages.
    expect(screen.getByTestId("transcript")).toHaveTextContent("capability broker");
  });

  it("creates a chat session titled 'New chat' (not 'New session')", async () => {
    const user = userEvent.setup();
    renderChat();
    await user.click(screen.getByTestId("session-new"));
    await user.click(screen.getByTestId("session-new-opt-Haiku 4.8"));
    expect(useChat.getState().extra).toHaveLength(1);
    expect(useChat.getState().extra[0].title).toBe("New chat");
  });
});
