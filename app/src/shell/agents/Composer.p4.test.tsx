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

function resetStore(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  });
}

beforeEach(() => resetStore());

describe("Composer P4 — prompt-log", () => {
  it("records the sent prompt in the per-session log", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    await user.type(input, "ship the teardown");
    await user.click(screen.getByTestId("composer-send"));
    const id = useAgents.getState().activeId;
    expect(useAgents.getState().promptLogs[id]).toEqual(["ship the teardown"]);
  });
});

describe("Composer P4 — history-recall", () => {
  it("↑ on an empty composer loads the most recent prompt", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    await user.type(input, "first prompt");
    await user.click(screen.getByTestId("composer-send"));
    // Composer is now empty (send cleared it). ↑ recalls the last prompt.
    await user.click(input);
    await user.keyboard("{ArrowUp}");
    expect(input.value).toBe("first prompt");
  });

  it("↑ on a NON-empty composer does not recall (caret nav preserved)", async () => {
    resetStore({ promptLogs: { s1: ["old prompt"] } });
    const user = userEvent.setup();
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    await user.type(input, "typing something");
    await user.keyboard("{ArrowUp}");
    // Unchanged — history recall must not clobber an active draft.
    expect(input.value).toBe("typing something");
  });
});

describe("Composer P4 — draft persistence (golden-safety)", () => {
  it("shows NO restored-draft affordance on a fresh boot (empty store)", () => {
    renderWorkspace();
    expect(screen.queryByTestId("composer-draft-restored")).not.toBeInTheDocument();
    expect(screen.getByTestId<HTMLTextAreaElement>("composer-input").value).toBe("");
  });

  it("restores a persisted draft into the textarea + shows the affordance", () => {
    resetStore({ draftBodies: { s1: "half-written idea" } });
    renderWorkspace();
    expect(screen.getByTestId<HTMLTextAreaElement>("composer-input").value).toBe(
      "half-written idea",
    );
    expect(screen.getByTestId("composer-draft-restored")).toBeInTheDocument();
  });

  it("Clear removes the draft affordance, empties the field, and clears the store", async () => {
    resetStore({ draftBodies: { s1: "discard me" } });
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("composer-draft-clear"));
    expect(screen.queryByTestId("composer-draft-restored")).not.toBeInTheDocument();
    expect(screen.getByTestId<HTMLTextAreaElement>("composer-input").value).toBe("");
    expect(useAgents.getState().draftBodies.s1).toBeUndefined();
  });

  it("autosaves the typed body to the store (debounced)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.type(screen.getByTestId("composer-input"), "draft in progress");
    await waitFor(() => expect(useAgents.getState().draftBodies.s1).toBe("draft in progress"));
  });
});
