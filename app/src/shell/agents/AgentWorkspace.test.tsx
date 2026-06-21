import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { mockAgentProvider } from "@/mocks";
import { AgentWorkspace } from "./AgentWorkspace";
import { useAgents } from "./store";

function renderWorkspace() {
  return render(
    <ThemeProvider>
      <div style={{ height: 800 }}>
        <AgentWorkspace />
      </div>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.removeItem("capisco-agents");
  useAgents.setState({
    extra: [],
    closed: [],
    activeId: "s1",
    runStates: {},
    model: "Opus 4.8",
    effort: 3,
    backendKind: "api",
    settingsOpen: false,
    selectedBackendId: "stub",
  });
});

afterEach(() => {
  useAgents.setState({ extra: [], closed: [], activeId: "s1", runStates: {}, settingsOpen: false });
});

describe("AgentWorkspace", () => {
  it("renders session tabs with status, model badge, title and meta", () => {
    renderWorkspace();
    const tab = screen.getByTestId("session-tab-s1");
    expect(within(tab).getByText("Implement worktree teardown")).toBeInTheDocument();
    expect(screen.getByTestId("session-meta-s1")).toHaveTextContent("2m 49s");
  });

  it("shows the subagent row only for sessions that have children", () => {
    renderWorkspace();
    expect(screen.getByTestId("subagent-row")).toBeInTheDocument();
    expect(screen.getByTestId("subagent-chip-s1a")).toHaveTextContent("Subagent · write tests");
  });

  it("renders the permission prompt with scope buttons", () => {
    renderWorkspace();
    const prompt = screen.getByTestId("permission-prompt");
    expect(within(prompt).getByTestId("permission-command")).toHaveTextContent(
      "Bash(rm -rf .worktrees/tmp)",
    );
    expect(within(prompt).getByTestId("permission-scope-0")).toHaveTextContent("Allow once");
  });

  it("shows a secret as a credential reference, never a value (invariant §3.2)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-select-s3"));
    const cred = screen.getByTestId("permission-credential");
    expect(cred).toHaveTextContent("credential: staging-admin");
    // No raw secret value leaks into the prompt.
    expect(cred.textContent).not.toMatch(/sk-/);
  });

  it("creates a new session via the new-session menu (model first)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-new"));
    await user.click(screen.getByTestId("session-new-opt-GPT-5"));
    expect(useAgents.getState().extra).toHaveLength(1);
    expect(useAgents.getState().activeId).toBe("n1");
    expect(screen.getByTestId("transcript-empty")).toBeInTheDocument();
  });

  it("closes a session and switches active to a remaining one", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-close-s1"));
    expect(useAgents.getState().closed).toContain("s1");
    expect(screen.queryByTestId("session-tab-s1")).not.toBeInTheDocument();
  });

  it("virtualizes the transcript — only a window of a 500-block session renders", async () => {
    expect(await mockAgentProvider.getBlocks("s4")).toHaveLength(500);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-select-s4"));
    const rows = screen.getByTestId("transcript").querySelectorAll("[data-vrow]");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(120);
  });

  it("opens the backend settings popover and switches between API and CLI", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-gear"));
    expect(screen.getByTestId("agent-settings")).toBeInTheDocument();
    expect(screen.getByTestId("agent-settings-api-body")).toBeInTheDocument();
    await user.click(screen.getByTestId("agent-settings-cli"));
    expect(screen.getByTestId("agent-settings-cli-body")).toHaveTextContent("/usr/local/bin/claude");
  });

  it("lists the agent backends with status + actions; the stub is the default in-use backend", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-gear"));
    // Backend picker is CLI-tab ONLY — it must NOT appear in the API-client tab.
    expect(screen.queryByTestId("agent-settings-backends")).toBeNull();
    await user.click(screen.getByTestId("agent-settings-cli"));
    const list = screen.getByTestId("agent-settings-backends");

    // All four backends are present (Stub / native / ACP bridge / Codex).
    expect(within(list).getByTestId("agent-backend-stub")).toBeInTheDocument();
    expect(within(list).getByTestId("agent-backend-claude-native")).toBeInTheDocument();
    expect(within(list).getByTestId("agent-backend-claude-code-acp")).toBeInTheDocument();
    expect(within(list).getByTestId("agent-backend-codex")).toBeInTheDocument();

    // The deterministic stub is ready + the selected default ("In use", disabled).
    expect(screen.getByTestId("agent-backend-stub")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("agent-backend-stub-use")).toBeDisabled();

    // The ACP bridge is installable — Install is broker-gated, never silent.
    const install = screen.getByTestId("agent-backend-claude-code-acp-install");
    expect(install).toBeInTheDocument();
    await user.click(install);
    const gate = screen.getByTestId("agent-settings-install-gate");
    expect(gate).toHaveTextContent("npm i -g @zed-industries/claude-code-acp");
    expect(gate).toHaveTextContent("never silent");

    // The native backend needs a guided setup (link, not an auto-install).
    expect(screen.getByTestId("agent-backend-claude-native-guide")).toHaveAttribute("href");
  });

  it("selecting a ready backend persists the choice", async () => {
    const user = userEvent.setup();
    // The Stub backend is `ready` and selectable; selecting it is a no-op when
    // already in use, so assert the store wiring directly via setSelectedBackend.
    renderWorkspace();
    await user.click(screen.getByTestId("session-gear"));
    expect(useAgents.getState().selectedBackendId).toBe("stub");
    useAgents.getState().setSelectedBackend("claude-code-acp");
    expect(useAgents.getState().selectedBackendId).toBe("claude-code-acp");
    // Persisted under the agents store key.
    expect(localStorage.getItem("capisco-agents")).toContain("claude-code-acp");
  });

  it("renders empty / loading / error transcript states", async () => {
    renderWorkspace();
    useAgents.setState({ runStates: { s1: "loading" } });
    expect(await screen.findByTestId("transcript-loading")).toBeInTheDocument();
    useAgents.setState({ runStates: { s1: "error" } });
    expect(await screen.findByTestId("transcript-error")).toBeInTheDocument();
  });
});
