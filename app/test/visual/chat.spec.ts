import { test, expect, type Page } from "@playwright/test";

// Chat = the SAME component as Agents, parameterized kind="chat" (Design-Sync
// P3). DOM/structure assertions are the primary autonomy gate; the screenshot
// is a tripwire for the shared-component fidelity.

async function gotoChat(page: Page) {
  await page.goto("/");
  await page.getByTestId("mode-chat").click();
  await expect(page.getByTestId("chat-workspace")).toBeVisible();
}

test.describe("chat workspace — routing + structure (Design-Sync P3)", () => {
  test("the right-bar Chat button switches the center workspace to chat", async ({ page }) => {
    await page.goto("/");
    // Default landing is agents.
    await expect(page.getByTestId("agent-workspace")).toBeVisible();
    await expect(page.getByTestId("mode-chat")).toBeVisible();
    await page.getByTestId("mode-chat").click();
    await expect(page.getByTestId("chat-workspace")).toBeVisible();
    await expect(page.getByTestId("agent-workspace")).toHaveCount(0);
    await expect(page.getByTestId("chat-workspace")).toHaveAttribute("data-kind", "chat");
    // Switch back to agents.
    await page.getByTestId("mode-agents").click();
    await expect(page.getByTestId("agent-workspace")).toBeVisible();
    await expect(page.getByTestId("chat-workspace")).toHaveCount(0);
  });

  test("chat reuses the shared UI (tabs, model picker, composer, settings)", async ({ page }) => {
    await gotoChat(page);
    await expect(page.getByTestId("session-tabbar")).toBeVisible();
    await expect(page.getByTestId("session-tab-c1")).toContainText("Broker prompting rules");
    await expect(page.getByTestId("session-new")).toBeVisible();
    await expect(page.getByTestId("session-gear")).toBeVisible();
    await expect(page.getByTestId("composer-input")).toBeVisible();
    await expect(page.getByTestId("composer-model")).toContainText("Sonnet 4.8");
  });

  test("chat has no subagents / tool actions / permission prompts", async ({ page }) => {
    await gotoChat(page);
    await expect(page.getByTestId("subagent-row")).toHaveCount(0);
    await expect(page.getByTestId("tool-action")).toHaveCount(0);
    await expect(page.getByTestId("permission-prompt")).toHaveCount(0);
    await expect(page.getByTestId("composer-status")).toContainText("quick chat · no tools");
  });
});

test.describe("chat workspace — fidelity golden", () => {
  test("matches the dark golden", async ({ page }) => {
    await gotoChat(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("chat-dark.png");
  });
});

test.describe("chat workspace — a11y (contrast tracked separately)", () => {
  test("no serious/critical axe violations beyond tracked contrast", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await gotoChat(page);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
  });
});
