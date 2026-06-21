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
  useAgents.setState({
    extra: [],
    closed: [],
    activeId: "s1",
    runStates: {},
    model: "Opus 4.8",
    effort: 3,
    backendKind: "api",
    settingsOpen: false,
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

  it("renders empty / loading / error transcript states", async () => {
    renderWorkspace();
    useAgents.setState({ runStates: { s1: "loading" } });
    expect(await screen.findByTestId("transcript-loading")).toBeInTheDocument();
    useAgents.setState({ runStates: { s1: "error" } });
    expect(await screen.findByTestId("transcript-error")).toBeInTheDocument();
  });
});
