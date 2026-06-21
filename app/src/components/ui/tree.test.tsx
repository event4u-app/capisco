import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tree, type TreeRowData } from "./tree";

const ROWS: TreeRowData[] = [
  { id: "src", label: "src", depth: 0, expandable: true, expanded: true },
  { id: "core", label: "core", depth: 1, expandable: true, expanded: false },
  { id: "pkg", label: "package.json", depth: 0 },
];

describe("Tree", () => {
  it("renders treeitems with correct aria levels", () => {
    render(<Tree rows={ROWS} label="files" />);
    const items = screen.getAllByRole("treeitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("aria-level", "1");
    expect(items[1]).toHaveAttribute("aria-level", "2");
  });

  it("selects a row on click", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<Tree rows={ROWS} onSelect={onSelect} label="files" />);
    await user.click(screen.getByText("package.json"));
    expect(onSelect).toHaveBeenCalledWith("pkg");
  });

  it("toggles an expandable row via its chevron", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<Tree rows={ROWS} onToggle={onToggle} label="files" />);
    await user.click(screen.getAllByRole("button", { name: /collapse|expand/i })[0]);
    expect(onToggle).toHaveBeenCalledWith("src");
  });
});
