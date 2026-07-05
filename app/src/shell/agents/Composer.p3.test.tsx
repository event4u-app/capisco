/**
 * Composer P3 — empty-state next-task suggestions (interaction level).
 *
 * Verifies the boot-visible behaviour through the real workspace: suggestions
 * show while empty, a click FILLS the composer without sending, and typing hides
 * them again. Same mock harness as the P4 tests (browser path, no desktop).
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { AgentWorkspace, ChatWorkspace } from "./AgentWorkspace";
import { useAgents, useChat } from "./store";

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
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.removeItem("capisco-agents");
  localStorage.removeItem("capisco-chat");
  useAgents.setState(baseState());
  useChat.setState(baseState());
});

describe("Composer P3 — empty-state suggestions", () => {
  it("shows deterministic suggestion rows in an empty agent composer", () => {
    render(
      <ThemeProvider>
        <div style={{ height: 800 }}>
          <AgentWorkspace />
        </div>
      </ThemeProvider>,
    );
    expect(screen.getByTestId("composer-empty-suggestions")).toBeInTheDocument();
    // The dirty-file + git-branch rows come from the deterministic mocks.
    expect(screen.getByTestId("composer-suggestion-open-file")).toBeInTheDocument();
    expect(screen.getByTestId("composer-suggestion-git-branch")).toBeInTheDocument();
  });

  it("clicking a suggestion fills the composer WITHOUT sending", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <div style={{ height: 800 }}>
          <AgentWorkspace />
        </div>
      </ThemeProvider>,
    );
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    expect(input.value).toBe("");

    await user.click(screen.getByTestId("composer-suggestion-open-file"));

    expect(input.value).not.toBe("");
    // No auto-send: run-state stays ready and no prompt was logged.
    expect(useAgents.getState().runStates.s1 ?? "ready").toBe("ready");
    expect(useAgents.getState().promptLogs.s1 ?? []).toEqual([]);
    // The block disappears once the composer is non-empty.
    await waitFor(() =>
      expect(screen.queryByTestId("composer-empty-suggestions")).not.toBeInTheDocument(),
    );
  });

  it("typing hides the suggestions; clearing brings them back", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <div style={{ height: 800 }}>
          <AgentWorkspace />
        </div>
      </ThemeProvider>,
    );
    const input = screen.getByTestId<HTMLTextAreaElement>("composer-input");
    await user.type(input, "hello");
    expect(screen.queryByTestId("composer-empty-suggestions")).not.toBeInTheDocument();
    await user.clear(input);
    await waitFor(() =>
      expect(screen.getByTestId("composer-empty-suggestions")).toBeInTheDocument(),
    );
  });

  it("chat mode with no history renders no suggestion block", () => {
    render(
      <ThemeProvider>
        <div style={{ height: 800 }}>
          <ChatWorkspace />
        </div>
      </ThemeProvider>,
    );
    expect(screen.queryByTestId("composer-empty-suggestions")).not.toBeInTheDocument();
  });
});
