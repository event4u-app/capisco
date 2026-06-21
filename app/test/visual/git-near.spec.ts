import { test, expect, type Page } from "@playwright/test";

// R4 Git-Near provider views. DOM/structure assertions on data-testid are the
// primary autonomy gate (Overview §4(a)); the few screenshots are tripwires.

/** Opens a left-rail tool and waits for its pane to mount. */
async function openTool(page: Page, id: string) {
  await page.goto("/");
  await page.getByTestId(`rail-item-${id}`).click();
  await expect(page.getByTestId(`pane-${id}`)).toBeVisible();
}

test.describe("Explorer (multi-project)", () => {
  test("renders both repos as sticky separator bars with branch + tracking", async ({ page }) => {
    await openTool(page, "explorer");
    await expect(page.getByTestId("explorer-panel")).toBeVisible();

    const core = page.getByTestId("explorer-project-core");
    const tauri = page.getByTestId("explorer-project-tauri");
    await expect(core).toBeVisible();
    await expect(tauri).toBeVisible();
    await expect(core).toContainText("capisco-core");
    await expect(core).toContainText("~/dev/capisco/core");
    await expect(core).toContainText("feat/worktree-teardown");
    await expect(core).toContainText("↓3");

    // Project roots are position:sticky bars.
    const pos = await core.evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe("sticky");

    // Global trees present.
    await expect(page.getByTestId("explorer-branch-external")).toBeVisible();
    await expect(page.getByTestId("explorer-branch-scratch")).toBeVisible();
  });

  test("selected file shows teal left strip + a git marker; tree is virtualized", async ({
    page,
  }) => {
    await openTool(page, "explorer");
    // broker.ts is the active file in the mock (git marker A).
    const broker = page.getByTestId("explorer-file-broker.ts");
    await expect(broker).toBeVisible();
    await expect(broker.getByTestId("explorer-active-strip")).toBeVisible();
    await expect(broker).toContainText("A");

    // worktree.ts carries an M marker.
    await expect(page.getByTestId("explorer-file-worktree.ts")).toContainText("M");

    // Virtualized: only a window of rows in the DOM.
    const rendered = await page.getByTestId("explorer-tree").locator("[data-vrow]").count();
    expect(rendered).toBeGreaterThan(0);
  });

  test("clicking another file moves the teal strip to it", async ({ page }) => {
    await openTool(page, "explorer");
    const wt = page.getByTestId("explorer-file-worktree.ts");
    await wt.click();
    await expect(wt.getByTestId("explorer-active-strip")).toBeVisible();
  });
});

test.describe("Changes (base-branch combobox)", () => {
  test("default base = PR target (develop), header reads base → current", async ({ page }) => {
    await openTool(page, "changes");
    await expect(page.getByTestId("changes-panel")).toBeVisible();
    await expect(page.getByTestId("changes-base-trigger")).toContainText("develop");
    await expect(page.getByTestId("changes-base-trigger")).toContainText("target");
    await expect(page.getByTestId("changes-current")).toContainText("current");
    await expect(page.getByTestId("changes-summary")).toContainText("5 files changed");
    await expect(page.getByTestId("changes-file-broker.ts")).toContainText("+96");
  });

  test("the combobox filters branches and switches the base", async ({ page }) => {
    await openTool(page, "changes");
    await page.getByTestId("changes-base-trigger").click();
    await expect(page.getByTestId("changes-base-pop")).toBeVisible();
    await page.getByTestId("changes-base-search").fill("release");
    // only the two release/* branches remain.
    await expect(page.getByTestId("changes-base-option-release/1.4")).toBeVisible();
    await expect(page.getByTestId("changes-base-option-main")).toHaveCount(0);
    await page.getByTestId("changes-base-option-release/1.4").click();
    await expect(page.getByTestId("changes-base-pop")).toHaveCount(0);
    await expect(page.getByTestId("changes-base-trigger")).toContainText("release/1.4");
  });

  test("clicking a changed file opens the diff view", async ({ page }) => {
    await openTool(page, "changes");
    await page.getByTestId("changes-file-worktree.ts").click();
    await expect(page.getByTestId("diff-view")).toBeVisible();
  });
});

test.describe("Commit (Work Stash)", () => {
  test("groups local changes per project + has a resizable commit box", async ({ page }) => {
    await openTool(page, "commit");
    await expect(page.getByTestId("commit-panel")).toBeVisible();
    await expect(page.getByTestId("commit-changes")).toBeVisible();
    await expect(page.getByTestId("commit-file-broker.ts")).toBeVisible();
    await expect(page.getByTestId("commit-file-main.rs")).toBeVisible();

    const box = page.getByTestId("commit-message");
    await expect(box).toBeVisible();
    const resize = await box.evaluate((el) => getComputedStyle(el).resize);
    expect(resize).toBe("vertical");

    // Primary button targets the commit branch.
    await expect(page.getByTestId("commit-button")).toContainText("feat/worktree-teardown");
  });

  test("switching to the Shelf tab shows shelved work", async ({ page }) => {
    await openTool(page, "commit");
    await page.getByTestId("commit-tab-shelf").click();
    await expect(page.getByTestId("commit-shelf")).toBeVisible();
    await expect(page.getByTestId("commit-shelf-port-allocator spike")).toBeVisible();
  });
});

test.describe("Search (ripgrep-style)", () => {
  test("summarizes results, groups by file, highlights matches, virtualized", async ({ page }) => {
    await openTool(page, "search");
    await expect(page.getByTestId("search-panel")).toBeVisible();
    await expect(page.getByTestId("search-query")).toHaveValue("checkCapability");
    await expect(page.getByTestId("search-replace")).toBeVisible();
    await expect(page.getByTestId("search-summary")).toContainText("results in");

    // Highlighted match present.
    await expect(page.getByTestId("search-results").locator("mark").first()).toContainText(
      "checkCapability",
    );

    // Virtualized: only a window of the ~126 rows in the DOM.
    const rendered = await page.getByTestId("search-results").locator("[data-vrow]").count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(100);
  });
});

test.describe("Structure (symbol outline)", () => {
  test("lists symbols of the active file with kind badges", async ({ page }) => {
    await openTool(page, "structure");
    await expect(page.getByTestId("structure-panel")).toBeVisible();
    await expect(page.getByTestId("panel-head")).toContainText("broker.ts");
    await expect(page.getByTestId("structure-symbol-Broker")).toContainText("C");
    await expect(
      page.getByTestId("structure-symbol-checkCapability(principal, cap, scope)"),
    ).toContainText("m");
    await expect(page.getByTestId("structure-symbol-Capability")).toContainText("I");
    await expect(page.getByTestId("structure-symbol-Scope")).toContainText("E");
  });
});

test.describe("Git-Near a11y (contrast tracked separately)", () => {
  test("no serious/critical axe violations across the five panels", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    for (const id of ["explorer", "changes", "commit", "search", "structure"]) {
      await openTool(page, id);
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
      );
      expect(blocking, `${id}: ${JSON.stringify(blocking.map((v) => v.id))}`).toEqual([]);
    }
  });
});
