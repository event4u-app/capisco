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

describe("Composer → mock path intact (no bridge)", () => {
  it("Case B: with no bridge, sendPrompt never fires and the mock transcript still renders", async () => {
    desktopState.value = false;
    const user = userEvent.setup();
    renderWorkspace();

    // The mock agents session (s1) renders a permission prompt block — proof the
    // snapshot path is intact and untouched by the live wiring. (After a send the
    // session flips to `loading` and shows the loading state by design, so the
    // mock-block proof is read here, before the send.)
    expect(screen.getByTestId("permission-prompt")).toBeInTheDocument();

    const input = screen.getByTestId("composer-input");
    await user.type(input, "no bridge here");
    await user.click(screen.getByTestId("composer-send"));

    // No bridge → the live agent run never fires; the mock path is untouched.
    expect(sendPrompt).not.toHaveBeenCalled();
  });
});
