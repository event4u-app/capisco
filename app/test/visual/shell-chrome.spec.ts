import { test, expect, type Page } from "@playwright/test";

// DOM/structure assertions are the primary autonomy gate (Overview §4(a));
// the few screenshots here are tripwires for new screens.

async function gridCols(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="main-row"]') as HTMLElement;
    return getComputedStyle(el).gridTemplateColumns;
  });
}

test.describe("chrome grid + chrome heights", () => {
  test("default grid is [48][0][1fr][0][48]; title 40 / status 26", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell")).toBeVisible();
    const cols = (await gridCols(page)).split(/\s+/);
    // five columns; the two panel columns collapse to 0px when empty.
    expect(cols).toHaveLength(5);
    expect(cols[0]).toBe("48px");
    expect(cols[1]).toBe("0px");
    expect(cols[3]).toBe("0px");
    expect(cols[4]).toBe("48px");

    const title = await page.getByTestId("titlebar").boundingBox();
    const status = await page.getByTestId("status-bar").boundingBox();
    expect(Math.round(title!.height)).toBe(40);
    expect(Math.round(status!.height)).toBe(26);
  });

  test("status-bar fields appear in order", async ({ page }) => {
    await page.goto("/");
    const text = await page.getByTestId("status-bar").innerText();
    // Breadcrumb already contains "capisco", so the meaningful ordering check is
    // over the trailing field tokens (the brand check is structural, below).
    const order = ["TypeScript", "Ln", "LF", "UTF-8"];
    let last = -1;
    for (const token of order) {
      const idx = text.indexOf(token);
      expect(idx, `"${token}" present and ordered`).toBeGreaterThan(last);
      last = idx;
    }
    // Branch + sync indicator and brand are present.
    expect(text).toContain("⎇ main");
    expect(text.trimEnd().endsWith("capisco")).toBe(true);
  });
});

test.describe("panels, splits, terminal", () => {
  test("opening a tool widens the left panel column to 260px", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("rail-item-pr").click();
    await expect(page.getByTestId("left-panel-stack")).toBeVisible();
    const cols = (await gridCols(page)).split(/\s+/);
    expect(cols[1]).toBe("260px");
    await expect(page).toHaveScreenshot("panel-open-dark.png");
  });

  test("re-clicking the active tool collapses its panel back to 0px", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("rail-item-pr").click();
    await page.getByTestId("rail-item-pr").click();
    const cols = (await gridCols(page)).split(/\s+/);
    expect(cols[1]).toBe("0px");
  });

  test("terminal toggles a bottom panel with a draggable splitter", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("rail-item-__terminal__").click();
    await expect(page.getByTestId("terminal-panel")).toBeVisible();
    await expect(page.getByTestId("terminal-splitter")).toBeVisible();
    await expect(page).toHaveScreenshot("terminal-open-dark.png");
  });

  test("the empty bottom group shows the persistent dashed dock zone", async ({ page }) => {
    await page.goto("/");
    const zone = page.getByTestId("rail-bottom-drop-right");
    await expect(zone).toBeVisible();
    await expect(zone).toContainText("Dock");
  });
});

test.describe("drag & dock persistence", () => {
  test("layout (mode + terminal) survives reload via localStorage", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mode-git").click();
    await page.getByTestId("rail-item-__terminal__").click();
    await expect(page.getByTestId("terminal-panel")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("status-bar")).toBeVisible();
    // terminal stays open, mode stays git, after reload (the Git Dashboard
    // center workspace is wired in R5, so mode persistence is read off the
    // workspace's data-mode attribute, not the old placeholder text).
    await expect(page.getByTestId("terminal-panel")).toBeVisible();
    await expect(page.getByTestId("workspace")).toHaveAttribute("data-mode", "git");
    await expect(page.getByTestId("git-workspace")).toBeVisible();
  });
});

test.describe("diff view", () => {
  test("opens from the palette, toggles split/unified, closes to prior mode", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mode-editor").click();
    await page.keyboard.press("Meta+k");
    await expect(page.getByTestId("palette-input")).toBeVisible();
    await page.getByTestId("palette-cmd-view:diff").click();
    await expect(page.getByTestId("diff-view")).toBeVisible();
    await expect(page.getByTestId("diff-file")).toContainText("worktree.ts");
    await expect(page).toHaveScreenshot("diff-split-dark.png");
    await page.getByTestId("diff-toggle-unified").click();
    await expect(page).toHaveScreenshot("diff-unified-dark.png");
    await page.getByTestId("diff-close").click();
    // Returns to the prior mode (editor), which now renders the real R3 editor.
    await expect(page.getByTestId("workspace")).toHaveAttribute("data-mode", "editor");
    await expect(page.getByTestId("editor-workspace")).toBeVisible();
  });

  test("diff body is virtualized (only a window of rows is in the DOM)", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mode-editor").click();
    await page.keyboard.press("Control+k");
    await page.getByTestId("palette-cmd-view:diff").click();
    await expect(page.getByTestId("diff-view")).toBeVisible();
    const rendered = await page.getByTestId("diff-body").locator("[data-vrow]").count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(80); // 111 rows total, only a window rendered
  });
});

test.describe("command palette + presets / visibility (§5.4)", () => {
  test("Cmd-K opens the palette; a hidden tool stays findable (escalation ladder)", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Meta+k");
    await expect(page.getByTestId("palette-input")).toBeVisible();
    // Apply the PO preset (hides explorer/etc), then find the hidden Explorer.
    await page.getByTestId("palette-cmd-preset:po").click();
    await expect(page.getByTestId("rail-item-explorer")).toHaveCount(0); // hidden from rail
    await page.keyboard.press("Meta+k");
    await page.getByTestId("palette-cmd-tool:explorer").click();
    // hidden ≠ disabled: it is now visible and docked.
    await expect(page.getByTestId("rail-item-explorer")).toBeVisible();
    await expect(page.getByTestId("pane-explorer")).toBeVisible();
  });
});

test.describe("a11y (contrast tracked separately)", () => {
  test("no serious/critical axe violations with a panel + terminal open", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.goto("/");
    await page.getByTestId("rail-item-explorer").click();
    await page.getByTestId("rail-item-__terminal__").click();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
  });
});
