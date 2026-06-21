import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Three-layer evidence (Overview §4): DOM = primary gate, pixel golden = tripwire, axe = floor.
test.describe("app shell", () => {
  test("renders chrome structure (DOM primary gate)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell")).toBeVisible();
    await expect(page.getByTestId("titlebar")).toBeVisible();
    await expect(page.getByTestId("status-bar")).toBeVisible();
    await expect(page.getByTestId("workspace")).toBeVisible();
    await expect(page.getByTestId("activity-left")).toBeVisible();
    await expect(page.getByTestId("activity-right")).toBeVisible();
  });

  test("matches the visual golden (pixel tripwire)", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("shell-dark.png");
  });

  test("has no serious/critical a11y violations (contrast tracked separately)", async ({
    page,
  }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
    const contrast = results.violations.find((v) => v.id === "color-contrast");
    if (contrast) {
      console.warn(`[a11y][tracked] color-contrast: ${contrast.nodes.length} node(s) below AA 4.5:1.`);
    }
  });
});
