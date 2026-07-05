/**
 * Composer wiring — composer-intelligence fast-follows (S9 save, P4 Cmd+R
 * history overlay, C-2 expand). Exercised through AgentWorkspace so the store
 * seam (savedPrompts / savePrompt / promptLogs) is real.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { AgentWorkspace } from "./AgentWorkspace";
import { useAgents } from "./store";

vi.mock("@/lib/desktop-shell", () => ({
  isDesktop: () => false,
  getProviders: () => ({
    agent: {
      sendPrompt: () => Promise.resolve(),
      getBlocks: () => Promise.resolve([]),
      subscribe: () => () => {},
      getPendingPermission: () => Promise.resolve(null),
    },
    revert: { revertPath: () => Promise.resolve("skipped") },
    recent: { list: () => Promise.resolve([]) },
  }),
}));

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
    handoffSeeds: {},
    model: "Opus 4.8",
    effort: 3,
    budget: 200_000,
    terseEnabled: false,
    terseLevel: "full",
    terseHintSeen: true,
    routingEnabled: false,
    modelOverrides: {},
    backendKind: "api",
    settingsOpen: false,
    selectedBackendId: "stub",
    promptLogs: {},
    draftBodies: {},
    savedPrompts: [],
  });
});

describe("Composer — S9 save prompt (Cmd+S)", () => {
  it("saves the current buffer to the store on Cmd+S", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    await user.type(input, "review the migration plan");
    await user.keyboard("{Meta>}s{/Meta}");
    expect(useAgents.getState().savedPrompts.map((p) => p.body)).toEqual([
      "review the migration plan",
    ]);
  });

  it("does not save an empty buffer", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    input.focus();
    await user.keyboard("{Meta>}s{/Meta}");
    expect(useAgents.getState().savedPrompts).toEqual([]);
  });
});

describe("Composer — P4 history overlay (Cmd+R)", () => {
  it("opens the overlay over the session prompt log and fills on pick", async () => {
    const user = userEvent.setup();
    useAgents.setState({ promptLogs: { s1: ["earlier prompt"] } });
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    input.focus();
    await user.keyboard("{Meta>}r{/Meta}");
    expect(screen.getByTestId("history-overlay")).toBeInTheDocument();
    await user.click(screen.getByTestId("history-item-0"));
    await waitFor(() =>
      expect(screen.getByTestId<HTMLTextAreaElement>("composer-input").value).toBe(
        "earlier prompt",
      ),
    );
  });

  it("stays closed on Cmd+R when the log is empty", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    input.focus();
    await user.keyboard("{Meta>}r{/Meta}");
    expect(screen.queryByTestId("history-overlay")).not.toBeInTheDocument();
  });
});

describe("Composer — C-2 expand toggle", () => {
  it("toggles the cmp-expanded class and collapses on Esc", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const box = screen.getByTestId("composer-box");
    expect(box).not.toHaveClass("cmp-expanded");
    await user.click(screen.getByTestId("composer-expand"));
    expect(box).toHaveClass("cmp-expanded");
    await user.click(screen.getByTestId<HTMLTextAreaElement>("composer-input"));
    await user.keyboard("{Escape}");
    expect(box).not.toHaveClass("cmp-expanded");
  });
});
