import { test, expect, type Page } from "@playwright/test";

// R6 Tooling-Breadth: Services (ctop), Data (prod read-only invariant),
// Alerts/Inspect flyouts (pin→dock vs overlay) + the shared signal surface.
// DOM/structure assertions on data-testid are the primary autonomy gate
// (Overview §4(a)); the screenshots are tripwires.

async function gridCols(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="main-row"]') as HTMLElement;
    return getComputedStyle(el).gridTemplateColumns;
  });
}

/** Opens a LEFT-rail tool and waits for its pane to mount. */
async function openLeftTool(page: Page, id: string) {
  await page.goto("/");
  await page.getByTestId(`rail-item-${id}`).click();
  await expect(page.getByTestId(`pane-${id}`)).toBeVisible();
}

test.describe("Services (ctop, grouped by project)", () => {
  test("groups by loaded project with N/M up counts + sticky headers", async ({ page }) => {
    await openLeftTool(page, "services");
    await expect(page.getByTestId("services-panel")).toBeVisible();

    const core = page.getByTestId("services-group-capisco-core");
    const tauri = page.getByTestId("services-group-capisco-tauri");
    await expect(core).toBeVisible();
    await expect(tauri).toBeVisible();
    // capisco-core has 3 running of 4; tauri has 2/2.
    await expect(page.getByTestId("services-count-capisco-core")).toHaveText("3/4 up");
    await expect(page.getByTestId("services-count-capisco-tauri")).toHaveText("2/2 up");

    // Group header pins (position: sticky).
    const pos = await core.evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe("sticky");
  });

  test("each row carries a status dot, image, CPU bar, mem/ports + an exec -it action", async ({
    page,
  }) => {
    await openLeftTool(page, "services");
    const web = page.getByTestId("services-row-web");
    await expect(web).toBeVisible();
    await expect(web).toContainText("node:22");
    await expect(page.getByTestId("services-meta-web")).toContainText("34% cpu");
    await expect(page.getByTestId("services-meta-web")).toContainText("5173→5173");
    // Running container has a CPU bar; the console action is "exec -it".
    await expect(page.getByTestId("services-cpubar-web")).toBeVisible();
    await expect(page.getByTestId("services-console-web")).toHaveAttribute(
      "aria-label",
      /exec -it/,
    );

    // Exited container shows the honest "exited" state, no CPU bar, a Start action.
    await expect(page.getByTestId("services-meta-playwright")).toHaveText("exited");
    await expect(page.getByTestId("services-cpubar-playwright")).toHaveCount(0);
  });

  test("collapsing a group hides its rows", async ({ page }) => {
    await openLeftTool(page, "services");
    await expect(page.getByTestId("services-row-redis")).toBeVisible();
    await page.getByTestId("services-group-capisco-tauri").click();
    await expect(page.getByTestId("services-row-redis")).toHaveCount(0);
    await expect(page).toHaveScreenshot("services-collapsed-dark.png");
  });
});

test.describe("Data (datasource explorer, prod READ-ONLY invariant)", () => {
  test("groups by connection; prod shows READ-ONLY badge + per-table lock; NO write toggle", async ({
    page,
  }) => {
    await openLeftTool(page, "data");
    await expect(page.getByTestId("data-panel")).toBeVisible();

    // Every connection present, grouped.
    await expect(page.getByTestId("data-conn-local")).toBeVisible();
    await expect(page.getByTestId("data-conn-prod")).toBeVisible();

    // The READ-ONLY badge is ONLY on prod (invariant §2.2) — a fact, not a toggle.
    await expect(page.getByTestId("data-readonly-prod")).toBeVisible();
    await expect(page.getByTestId("data-readonly-prod")).toContainText("read-only");
    await expect(page.getByTestId("data-readonly-local")).toHaveCount(0);
    await expect(page.getByTestId("data-readonly-staging")).toHaveCount(0);

    // Expand prod → its tables each carry a lock glyph; there is no write toggle.
    await page.getByTestId("data-conn-prod").click();
    await expect(page.getByTestId("data-table-prod-audit_log")).toBeVisible();
    const tableLock = page
      .getByTestId("data-table-prod-users")
      .locator('[aria-label="read-only"]');
    await expect(tableLock).toBeVisible();
    // Hard invariant: within the Data panel, nothing offers a write / "make
    // writable" affordance — read-only is a fact, not a toggle.
    const dataPanel = page.getByTestId("data-panel");
    await expect(dataPanel.getByRole("switch")).toHaveCount(0);
    await expect(
      dataPanel.getByText(/allow permanently|enable write|make writable/i),
    ).toHaveCount(0);
  });

  test("the credential is a REFERENCE, never a value (invariant §2.1)", async ({ page }) => {
    await openLeftTool(page, "data");
    await page.getByTestId("data-conn-prod").click();
    const cred = page.getByTestId("data-credential-prod");
    await expect(cred).toBeVisible();
    await expect(cred).toContainText("credential: prod-readonly");
    // It must not surface a secret value shape.
    await expect(cred).not.toContainText(/password|token|=|:\/\//i);
    await expect(page).toHaveScreenshot("data-prod-readonly-dark.png");
  });
});

test.describe("Alerts / Inspect flyouts (pin → dock vs overlay)", () => {
  test("an unpinned flyout floats as an overlay and does NOT shrink the center", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("rail-item-alerts").click();
    // Overlay present; the right panel grid column stays collapsed (0px).
    await expect(page.getByTestId("flyout-overlay-alerts")).toBeVisible();
    const cols = (await gridCols(page)).split(/\s+/);
    expect(cols[3]).toBe("0px");
    await expect(page).toHaveScreenshot("alerts-overlay-dark.png");
  });

  test("clicking in the workspace dismisses the unpinned overlay", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("rail-item-alerts").click();
    await expect(page.getByTestId("flyout-overlay-alerts")).toBeVisible();
    await page.getByTestId("workspace").click({ position: { x: 200, y: 200 } });
    await expect(page.getByTestId("flyout-overlay-alerts")).toHaveCount(0);
  });

  test("pinning docks the flyout as a column so the center shrinks", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("rail-item-alerts").click();
    await page.getByTestId("signal-pin-alerts").click();
    // Now docked: overlay gone, right panel column = 340px.
    await expect(page.getByTestId("flyout-overlay-alerts")).toHaveCount(0);
    await expect(page.getByTestId("right-panel-stack")).toBeVisible();
    const cols = (await gridCols(page)).split(/\s+/);
    expect(cols[3]).toBe("340px");

    // A docked flyout no longer dismisses on a workspace click.
    await page.getByTestId("workspace").click({ position: { x: 200, y: 200 } });
    await expect(page.getByTestId("signal-flyout-alerts")).toBeVisible();
    await expect(page).toHaveScreenshot("alerts-pinned-dark.png");
  });
});

test.describe("Shared signal surface (§5.2 — one rail, two views)", () => {
  test("Alerts folds PR / container / observability / agent into one SignalItem shape", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("rail-item-alerts").click();
    const list = page.getByTestId("signal-list-alerts");
    await expect(list).toBeVisible();
    await expect(page.getByTestId("signal-flyout-alerts")).toContainText("one shared signal rail");

    // Distinct sources are present on the same rail (severity-dotted rows).
    const sources = await list.locator("[data-source]").evaluateAll((els) =>
      [...new Set(els.map((e) => e.getAttribute("data-source")))].sort(),
    );
    expect(sources).toEqual(expect.arrayContaining(["agent", "container", "observability", "pr"]));
    // A waiting-severity dot exists (the approval signal).
    await expect(page.getByTestId("signal-item-sig-1").locator(".bg-primary")).toBeVisible();
  });

  test("Inspect is the lint view of the SAME rail (routed by the dumb rules)", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("rail-item-inspect").click();
    const list = page.getByTestId("signal-list-inspect");
    await expect(list).toBeVisible();
    const sources = await list.locator("[data-source]").evaluateAll((els) =>
      [...new Set(els.map((e) => e.getAttribute("data-source")))],
    );
    expect(sources).toEqual(["lint"]);
  });
});

test.describe("R6 a11y (contrast tracked separately)", () => {
  test("no serious/critical axe violations across Services / Data / flyouts", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    // Left-rail panels.
    for (const id of ["services", "data"]) {
      await openLeftTool(page, id);
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
      );
      expect(blocking, `${id}: ${JSON.stringify(blocking.map((v) => v.id))}`).toEqual([]);
    }
    // Flyout (overlay) + pinned dock.
    await page.goto("/");
    await page.getByTestId("rail-item-alerts").click();
    await expect(page.getByTestId("flyout-overlay-alerts")).toBeVisible();
    const overlayRes = await new AxeBuilder({ page }).analyze();
    const overlayBlocking = overlayRes.violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
    );
    expect(overlayBlocking, JSON.stringify(overlayBlocking.map((v) => v.id))).toEqual([]);
  });
});
