import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { AgentWorkspace } from "./AgentWorkspace";
import { useAgents } from "./store";

// The desktop-shell seam is the only thing that decides mock-vs-live. Mock it
// per-case: `isDesktop` flips the live gate; `getProviders().agent.sendPrompt`
// is the live call we assert. getBlocks/subscribe are minimal stubs so the
// Transcript's live-blocks path (desktop + agents) doesn't blow up.
const sendPrompt = vi.fn(() => Promise.resolve());
const desktopState = { value: false };

vi.mock("@/lib/desktop-shell", () => ({
  isDesktop: () => desktopState.value,
  getProviders: () => ({
    agent: {
      sendPrompt,
      getBlocks: () => Promise.resolve([]),
      subscribe: () => () => {},
      // The Transcript's live-permission hook reads this on the bridge path.
      getPendingPermission: () => Promise.resolve(null),
    },
    // `revert` is read by AgentWorkspace's onRevertPath callback (never fired
    // here), but keep a stub so the bundle shape is honest.
    revert: { revertPath: () => Promise.resolve("skipped") },
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
  sendPrompt.mockClear();
  desktopState.value = false;
  localStorage.removeItem("capisco-agents");
  // Mirror the store-reset shape from AgentWorkspace.test.tsx.
  useAgents.setState({
    extra: [],
    closed: [],
    activeId: "s1",
    runStates: {},
    handoffSeeds: {},
    model: "Opus 4.8",
    effort: 3,
    budget: 200_000,
    terseEnabled: true,
    terseLevel: "full",
    terseHintSeen: false,
    routingEnabled: false,
    modelOverrides: {},
    backendKind: "api",
    settingsOpen: false,
    selectedBackendId: "stub",
  });
});

describe("Composer → live agent run (bridge present)", () => {
  it("Case A: with a bridge, sending drives sendPrompt(activeSessionId, text)", async () => {
    desktopState.value = true;
    const user = userEvent.setup();
    renderWorkspace();

    const input = screen.getByTestId("composer-input");
    await user.type(input, "ship the teardown");
    await user.click(screen.getByTestId("composer-send"));

    expect(sendPrompt).toHaveBeenCalledTimes(1);
    expect(sendPrompt).toHaveBeenCalledWith(useAgents.getState().activeId, "ship the teardown");
  });
});

describe("Composer → browser mock path responds + settles (no bridge)", () => {
  it("Case B: with no bridge, the mock still dispatches sendPrompt and the run settles (no fake infinite spinner)", async () => {
    desktopState.value = false;
    const user = userEvent.setup();
    renderWorkspace();

    // The mock agents session (s1) renders a permission prompt block — proof the
    // snapshot path is intact (read before the send).
    expect(screen.getByTestId("permission-prompt")).toBeInTheDocument();

    const id = useAgents.getState().activeId;
    const input = screen.getByTestId("composer-input");
    await user.type(input, "no bridge here");
    await user.click(screen.getByTestId("composer-send"));

    // Browser/dev: the mock turn IS dispatched (P5) — this is what makes the
    // browser chat respond instead of no-op'ing.
    expect(sendPrompt).toHaveBeenCalledWith(id, "no bridge here");
    // And the run SETTLES back to ready (P2) — the stubbed sendPrompt resolves,
    // `completeRun` fires, so the loading spinner does not hang forever.
    await vi.waitFor(() => expect(useAgents.getState().runStates[id]).not.toBe("loading"));
  });

  it("an empty send does not start a hanging loading run", async () => {
    desktopState.value = false;
    const user = userEvent.setup();
    renderWorkspace();
    const id = useAgents.getState().activeId;
    // Focus the composer and send with no text.
    screen.getByTestId("composer-input").focus();
    await user.click(screen.getByTestId("composer-send"));
    expect(sendPrompt).not.toHaveBeenCalled();
    expect(useAgents.getState().runStates[id] ?? "ready").not.toBe("loading");
  });
});
