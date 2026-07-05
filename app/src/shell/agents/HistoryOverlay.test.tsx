/**
 * HistoryOverlay (composer-intelligence P4 fast-follow) — Cmd+R searchable
 * prompt-history modal. Most-recent-first, filter-as-you-type; picking FILLS
 * (never sends); Esc / scrim-click closes.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { HistoryOverlay } from "./HistoryOverlay";

function renderOverlay(log: string[], onPick = vi.fn(), onClose = vi.fn()) {
  render(
    <ThemeProvider>
      <HistoryOverlay log={log} onPick={onPick} onClose={onClose} />
    </ThemeProvider>,
  );
  return { onPick, onClose };
}

describe("HistoryOverlay", () => {
  it("lists the log most-recent-first", () => {
    renderOverlay(["first", "second", "third"]);
    const items = screen.getAllByTestId(/^history-item-/);
    expect(items.map((el) => el.textContent)).toEqual(["third", "second", "first"]);
  });

  it("filters as you type (case-insensitive substring)", async () => {
    const user = userEvent.setup();
    renderOverlay(["deploy the app", "run the tests", "review a deploy log"]);
    await user.type(screen.getByTestId("history-search"), "deploy");
    const items = screen.getAllByTestId(/^history-item-/);
    expect(items.map((el) => el.textContent)).toEqual([
      "review a deploy log",
      "deploy the app",
    ]);
  });

  it("shows the empty state when nothing matches", async () => {
    const user = userEvent.setup();
    renderOverlay(["alpha", "beta"]);
    await user.type(screen.getByTestId("history-search"), "zzz");
    expect(screen.getByTestId("history-empty")).toBeInTheDocument();
    expect(screen.queryAllByTestId(/^history-item-/)).toHaveLength(0);
  });

  it("fills the picked entry (never sends) on click", async () => {
    const user = userEvent.setup();
    const { onPick } = renderOverlay(["only prompt"]);
    await user.click(screen.getByTestId("history-item-0"));
    expect(onPick).toHaveBeenCalledWith("only prompt");
  });

  it("Enter picks the keyboard-selected entry", async () => {
    const user = userEvent.setup();
    const { onPick } = renderOverlay(["a", "b", "c"]);
    const search = screen.getByTestId("history-search");
    await user.type(search, "{ArrowDown}{Enter}"); // sel 0→1 → "b" (most-recent-first: c,b,a)
    expect(onPick).toHaveBeenCalledWith("b");
  });

  it("Esc closes the overlay", async () => {
    const user = userEvent.setup();
    const { onClose } = renderOverlay(["x"]);
    await user.type(screen.getByTestId("history-search"), "{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
