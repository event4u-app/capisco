import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { Shell } from "./Shell";
import { useLayout } from "./store";

beforeEach(() => {
  useLayout.getState().applyPreset("default");
  useLayout.setState({ mode: "agents", previousMode: "agents", terminalOpen: false });
});

function renderShell() {
  return render(
    <ThemeProvider>
      <Shell />
    </ThemeProvider>,
  );
}

describe("shell panels & terminal", () => {
  it("opens a left panel when a rail tool is clicked, closes when re-clicked", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(screen.queryByTestId("left-panel-stack")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("rail-item-pr"));
    expect(screen.getByTestId("left-panel-stack")).toBeInTheDocument();
    expect(screen.getByTestId("pane-pr")).toBeInTheDocument();
    await user.click(screen.getByTestId("rail-item-pr"));
    expect(screen.queryByTestId("left-panel-stack")).not.toBeInTheDocument();
  });

  it("shows a vertical split (header per pane + splitter) when both panes are active", async () => {
    const user = userEvent.setup();
    renderShell();
    // Put a second tool in the left-bottom group, then activate both.
    useLayout.getState().reorder("pr", "leftBottom", null);
    await user.click(screen.getByTestId("rail-item-explorer"));
    await user.click(screen.getByTestId("rail-item-pr"));
    expect(useLayout.getState().topActive).toBe("explorer");
    expect(useLayout.getState().botActive).toBe("pr");
    expect(screen.getByTestId("pane-header-explorer")).toBeInTheDocument();
    expect(screen.getByTestId("pane-header-pr")).toBeInTheDocument();
    expect(screen.getByTestId("left-panel-stack-splitter")).toBeInTheDocument();
  });

  it("closes a pane via its header close button", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByTestId("rail-item-explorer"));
    expect(screen.getByTestId("pane-explorer")).toBeInTheDocument();
    await user.click(screen.getByTestId("pane-close-explorer"));
    expect(screen.queryByTestId("pane-explorer")).not.toBeInTheDocument();
  });

  it("toggles the bottom terminal panel from the rail terminal item", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(screen.queryByTestId("terminal-panel")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("rail-item-__terminal__"));
    expect(screen.getByTestId("terminal-panel")).toBeInTheDocument();
    expect(screen.getByTestId("terminal-splitter")).toBeInTheDocument();
  });

  it("renders the persistent dashed bottom drop-zone with a dock hint when the group is empty", () => {
    renderShell();
    // rightBottom is empty by default → dashed zone present with the dock hint.
    const zone = screen.getByTestId("rail-bottom-drop-right");
    expect(zone).toBeInTheDocument();
    expect(zone.className).toContain("border-dashed");
    expect(within(zone).getByText("Dock")).toBeInTheDocument();
    // leftBottom holds the terminal by default → no dashed hint there.
    const leftZone = screen.getByTestId("rail-bottom-drop-left");
    expect(leftZone.className).not.toContain("border-dashed");
  });
});

describe("diff view", () => {
  it("opens diff, toggles split/unified, virtualizes rows, closes to previous mode", async () => {
    const user = userEvent.setup();
    renderShell();
    useLayout.getState().setMode("editor");
    useLayout.getState().setMode("diff");
    const view = await screen.findByTestId("diff-view");
    expect(within(view).getByTestId("diff-file")).toHaveTextContent("worktree.ts");
    // Virtualized: only a window of the 111 rows is in the DOM.
    const body = screen.getByTestId("diff-body");
    const rendered = body.querySelectorAll("[data-vrow]");
    expect(rendered.length).toBeLessThan(60);
    await user.click(screen.getByTestId("diff-toggle-unified"));
    await user.click(screen.getByTestId("diff-close"));
    expect(useLayout.getState().mode).toBe("editor");
  });
});

describe("command palette (escalation ladder + presets)", () => {
  it("opens via the title-bar trigger and runs a mode command", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Command palette" }));
    expect(await screen.findByTestId("palette-input")).toBeInTheDocument();
    await user.click(screen.getByTestId("palette-cmd-mode:git"));
    expect(useLayout.getState().mode).toBe("git");
  });

  it("keeps a hidden tool findable in the palette and un-hides it on open", async () => {
    const user = userEvent.setup();
    renderShell();
    useLayout.getState().applyPreset("po"); // hides explorer
    expect(useLayout.getState().hiddenTools).toContain("explorer");
    await user.click(screen.getByRole("button", { name: "Command palette" }));
    await user.click(screen.getByTestId("palette-cmd-tool:explorer"));
    // hidden ≠ disabled: opening it reveals it and docks it.
    expect(useLayout.getState().hiddenTools).not.toContain("explorer");
    expect(useLayout.getState().topActive).toBe("explorer");
  });
});
