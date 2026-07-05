/**
 * BranchSwitcher (S8) — gated render + jump. Renders nothing without
 * checkpoints (boot-invisible), a chip + popover when they exist, and calls
 * onJump with the picked checkpoint.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import type { CheckpointEntry } from "./store";
import { BranchSwitcher } from "./BranchSwitcher";

const cp = (id: string, label: string, leafId: string): CheckpointEntry => ({
  id,
  label,
  leafId,
  seq: Number(id.replace(/\D/g, "")) || 1,
});

function renderSwitcher(checkpoints: CheckpointEntry[], onJump = vi.fn()) {
  render(
    <ThemeProvider>
      <BranchSwitcher checkpoints={checkpoints} onJump={onJump} />
    </ThemeProvider>,
  );
  return onJump;
}

describe("BranchSwitcher", () => {
  it("renders nothing when there are no checkpoints (boot-invisible)", () => {
    renderSwitcher([]);
    expect(screen.queryByTestId("branch-switcher")).not.toBeInTheDocument();
  });

  it("shows a chip with the checkpoint count once checkpoints exist", () => {
    renderSwitcher([cp("cp1", "before refactor", "n3"), cp("cp2", "retry · edited", "n5")]);
    const chip = screen.getByTestId("branch-switcher");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent("2");
  });

  it("opens the popover and jumps to the picked checkpoint", async () => {
    const user = userEvent.setup();
    const onJump = renderSwitcher([cp("cp1", "before refactor", "n3")]);
    await user.click(screen.getByTestId("branch-switcher"));
    expect(screen.getByTestId("branch-pop")).toBeInTheDocument();
    await user.click(screen.getByTestId("branch-item-cp1"));
    expect(onJump).toHaveBeenCalledTimes(1);
    expect(onJump.mock.calls[0][0]).toMatchObject({ id: "cp1", leafId: "n3" });
  });
});
