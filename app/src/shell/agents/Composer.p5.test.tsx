/**
 * Agent-Cockpit P5-A — workspace-level interaction tests.
 *
 * Edit-&-Rerun: ↑-on-empty recalls the last prompt; editing + send forks a
 * "retry · edited" branch (never a plain overwrite); a fresh send does not.
 * Message-Queue: Cmd+Enter while a run is in flight enqueues (does not send);
 * chips render + remove; the queue drains on run COMPLETION, not on Stop.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { AgentWorkspace } from "./AgentWorkspace";
import { useAgents } from "./store";

const branch = vi.fn().mockResolvedValue("newleaf");
const getTree = vi.fn().mockResolvedValue({ activeLeaf: "leaf1", nodes: {} });
const sendPrompt = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/desktop-shell", () => ({
  isDesktop: () => false,
  getProviders: () => ({
    agent: {
      sendPrompt,
      branch,
      getTree,
      getBlocks: () => Promise.resolve([]),
      subscribe: () => () => {},
      getPendingPermission: () => Promise.resolve(null),
    },
    revert: { revertPath: () => Promise.resolve("skipped") },
    recent: { list: () => Promise.resolve([]) },
  }),
}));

function baseState(overrides: Record<string, unknown> = {}) {
  return {
    extra: [],
    closed: [],
    activeId: "s1",
    runStates: {},
    handoffSeeds: {},
    model: "Opus 4.8",
    effort: 3,
    budget: 200_000,
    terseEnabled: false,
    terseLevel: "full" as const,
    terseHintSeen: true,
    routingEnabled: false,
    modelOverrides: {},
    backendKind: "api" as const,
    settingsOpen: false,
    selectedBackendId: "stub",
    promptLogs: {},
    draftBodies: {},
    messageQueues: {},
    runCompletions: {},
    checkpoints: {},
    ...overrides,
  };
}

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
  branch.mockClear();
  getTree.mockClear();
  sendPrompt.mockClear();
  localStorage.removeItem("capisco-agents");
  useAgents.setState(baseState());
});

describe("Composer P5-A — Edit-&-Rerun-as-branch", () => {
  it("↑ recalls the last prompt; editing + send forks a 'retry · edited' branch", async () => {
    const user = userEvent.setup();
    useAgents.setState(baseState({ promptLogs: { s1: ["original prompt"] } }));
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");

    input.focus();
    await user.keyboard("{ArrowUp}"); // recall on empty
    expect(input.value).toBe("original prompt");

    await user.type(input, " edited");
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    await waitFor(() => expect(branch).toHaveBeenCalledTimes(1));
    expect(branch).toHaveBeenCalledWith("s1", "leaf1", "retry · edited");
  });

  it("a fresh (non-recalled) send does NOT fork a branch", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    await user.type(input, "a brand new prompt");
    await user.keyboard("{Meta>}{Enter}{/Meta}");
    // Give any async branch a tick — it must never fire.
    await Promise.resolve();
    expect(branch).not.toHaveBeenCalled();
  });
});

describe("Composer P5-A — message queue", () => {
  it("Cmd+Enter while running enqueues instead of sending", async () => {
    const user = userEvent.setup();
    useAgents.setState(baseState({ runStates: { s1: "loading" } }));
    renderWorkspace();
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    await user.type(input, "do this next");
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    // Queued, not sent: the prompt log is untouched, the chip is visible.
    expect(useAgents.getState().messageQueues.s1?.map((m) => m.text)).toEqual(["do this next"]);
    expect(useAgents.getState().promptLogs.s1 ?? []).toEqual([]);
    expect(screen.getByTestId("composer-queue")).toBeInTheDocument();
  });

  it("queue is hidden while idle (boot-invisible) and shown only while running", () => {
    useAgents.setState(baseState({ messageQueues: { s1: [{ id: "q1", text: "later" }] } }));
    renderWorkspace();
    // runState idle → queue row not rendered even though an entry exists.
    expect(screen.queryByTestId("composer-queue")).not.toBeInTheDocument();
  });

  it("a queued chip can be removed", async () => {
    const user = userEvent.setup();
    useAgents.setState(
      baseState({
        runStates: { s1: "loading" },
        messageQueues: { s1: [{ id: "q1", text: "x" }] },
      }),
    );
    renderWorkspace();
    expect(screen.getByTestId("queue-chip-q1")).toBeInTheDocument();
    await user.click(screen.getByTestId("queue-remove-q1"));
    expect(useAgents.getState().messageQueues.s1).toBeUndefined();
  });

  it("drains the head on run COMPLETION, not on Stop/cancel", async () => {
    useAgents.setState(
      baseState({
        runStates: { s1: "loading" },
        messageQueues: { s1: [{ id: "q1", text: "queued turn" }] },
      }),
    );
    renderWorkspace();

    // Stop (cancel) must NOT drain.
    useAgents.getState().cancelRun("s1");
    await Promise.resolve();
    expect(useAgents.getState().messageQueues.s1?.map((m) => m.text)).toEqual(["queued turn"]);

    // Put it back in-flight, then COMPLETE → the head drains (fires runSend).
    useAgents.getState().setRunState("s1", "loading");
    useAgents.getState().completeRun("s1");
    await waitFor(() => {
      expect(useAgents.getState().messageQueues.s1).toBeUndefined();
      expect(useAgents.getState().promptLogs.s1 ?? []).toContain("queued turn");
    });
  });
});

describe("Composer P5-A — checkpoint / branch switcher (S8)", () => {
  it("no branch-switcher at boot (no checkpoints)", () => {
    renderWorkspace();
    expect(screen.queryByTestId("branch-switcher")).not.toBeInTheDocument();
  });

  it("shows the switcher once a checkpoint exists and jumps via branch()", async () => {
    const user = userEvent.setup();
    useAgents.setState(
      baseState({
        checkpoints: { s1: [{ id: "cp1", label: "before refactor", leafId: "n3", seq: 1 }] },
      }),
    );
    renderWorkspace();
    await user.click(screen.getByTestId("branch-switcher"));
    await user.click(screen.getByTestId("branch-item-cp1"));
    // Jump forks from the checkpoint's leaf via the existing branch primitive.
    await waitFor(() => expect(branch).toHaveBeenCalledTimes(1));
    expect(branch).toHaveBeenCalledWith("s1", "n3", "before refactor");
  });
});
