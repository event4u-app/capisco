import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { useLayout } from "@/shell/store";
import App from "./App";

beforeEach(() => {
  useLayout.getState().applyPreset("default");
  useLayout.setState({ mode: "agents", terminalOpen: false });
});

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
    </ThemeProvider>,
  );
}

describe("app shell", () => {
  it("renders the window chrome (title bar, status bar, workspace, rails)", () => {
    renderApp();
    expect(screen.getByTestId("shell")).toBeInTheDocument();
    expect(screen.getByTestId("titlebar")).toBeInTheDocument();
    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
    expect(screen.getByTestId("activity-left")).toBeInTheDocument();
    expect(screen.getByTestId("activity-right")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });

  it("switches the workspace mode from the right rail", async () => {
    const user = userEvent.setup();
    renderApp();
    // Agents is the default mode and renders the real agent workspace (R2).
    expect(screen.getByTestId("agent-workspace")).toBeInTheDocument();
    await user.click(screen.getByTestId("mode-editor"));
    // Editor mode renders the real editor workspace (R3), not a placeholder.
    expect(screen.getByTestId("editor-workspace")).toBeInTheDocument();
    expect(screen.queryByTestId("agent-workspace")).not.toBeInTheDocument();
  });
});
