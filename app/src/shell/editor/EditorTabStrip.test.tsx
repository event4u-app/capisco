import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { editorSnapshot } from "@/mocks";
import { EditorTabStrip } from "./EditorTabStrip";
import { useEditor } from "./store";
import { useTabRows } from "./tab-rows-store";

function reset() {
  const tabs = editorSnapshot.getDocs().map((d) => ({
    file: d.file,
    ext: d.ext,
    label: d.file,
    pinned: !!d.pinned,
    dirty: !!d.dirty,
  }));
  useEditor.setState({ tabs, activeFile: tabs[0].file });
  useTabRows.setState({ rows: 1 });
  localStorage.removeItem("capisco-tabrows");
}

function renderStrip() {
  return render(
    <ThemeProvider>
      <EditorTabStrip />
    </ThemeProvider>,
  );
}

describe("EditorTabStrip — rows + overflow (Design-Sync P1)", () => {
  beforeEach(reset);
  afterEach(reset);

  it("defaults to a single row (horizontal scroll)", () => {
    renderStrip();
    expect(screen.getByTestId("editor-tab-strip")).toHaveAttribute("data-rows", "1");
  });

  it("the rows setting (1/2/3) flips the strip to multi-row wrap and persists", async () => {
    const user = userEvent.setup();
    renderStrip();
    await user.click(screen.getByTestId("editor-tab-overflow"));
    await user.click(screen.getByTestId("editor-tab-rows-3"));
    expect(screen.getByTestId("editor-tab-strip")).toHaveAttribute("data-rows", "3");
    expect(useTabRows.getState().rows).toBe(3);
    // The scroll container wraps when multi-row.
    expect(screen.getByTestId("editor-tab-scroll").className).toContain("flex-wrap");
    // Persisted under the prototype key.
    expect(localStorage.getItem("capisco-tabrows")).toContain("3");
  });

  it("the overflow dropdown lists every open tab and jumps on click", async () => {
    const user = userEvent.setup();
    renderStrip();
    await user.click(screen.getByTestId("editor-tab-overflow"));
    const menu = screen.getByTestId("editor-tab-menu");
    // Pin marker on the pinned tab, dirty marker on the dirty tab.
    expect(within(menu).getByTestId("editor-tab-menu-item-broker.ts")).toBeInTheDocument();
    expect(within(menu).getByTestId("editor-tab-menu-dirty-worktree.ts")).toBeInTheDocument();
    // Click a listed tab → it becomes active.
    await user.click(within(menu).getByTestId("editor-tab-menu-item-types.ts"));
    expect(useEditor.getState().activeFile).toBe("types.ts");
  });

  it("file tabs are NOT trimmed (no ellipsis on the label)", () => {
    renderStrip();
    const label = within(
      screen.getByTestId("editor-tab-select-ListProjectsControllerTest.ts"),
    ).getByText("ListProjectsControllerTest.ts");
    expect(label.className).not.toContain("truncate");
    expect(label.className).toContain("whitespace-nowrap");
  });
});
