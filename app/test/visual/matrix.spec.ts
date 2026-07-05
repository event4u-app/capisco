import { test, expect, type Page } from "@playwright/test";

// Agent-Matrix (road-to-agent-matrix-and-ambient P0) — a new workspace mode.
// DOM/structure assertions are the primary autonomy gate; the screenshot is a
// tripwire. The Matrix is a read-only projection of the session/subagent stream.

async function gotoMatrix(page: Page) {
  await page.goto("/");
  await page.getByTestId("mode-matrix").click();
  await expect(page.getByTestId("matrix-workspace")).toBeVisible();
}

test.describe("matrix workspace — routing + structure", () => {
  test("the activity-bar Matrix button switches the center workspace to matrix", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("agent-workspace")).toBeVisible(); // default landing
    await expect(page.getByTestId("mode-matrix")).toBeVisible();
    await page.getByTestId("mode-matrix").click();
    await expect(page.getByTestId("matrix-workspace")).toBeVisible();
    await expect(page.getByTestId("agent-workspace")).toHaveCount(0);
    // Switch back to agents (existing goldens/paths unaffected).
    await page.getByTestId("mode-agents").click();
    await expect(page.getByTestId("agent-workspace")).toBeVisible();
    await expect(page.getByTestId("matrix-workspace")).toHaveCount(0);
  });

  test("renders the session/subagent graph with nodes for the live sessions", async ({ page }) => {
    await gotoMatrix(page);
    await expect(page.getByTestId("matrix-graph")).toBeVisible();
    // The first mock session (s1) is a node in the graph.
    await expect(page.getByTestId("matrix-node-s1")).toBeVisible();
    await expect(page.getByTestId("matrix-count")).toContainText("sessions");
  });

  test("broker-ticker shows decisions and expands to the full trail (secret as ref, never value)", async ({
    page,
  }) => {
    await gotoMatrix(page);
    await expect(page.getByTestId("broker-ticker")).toBeVisible();
    await page.getByTestId("broker-toggle").click();
    const list = page.getByTestId("broker-audit-list");
    await expect(list).toBeVisible();
    await expect(list).toContainText("credential: staging-admin"); // secret as NAME
    await expect(list).not.toContainText(/sk-|ghp_|AKIA/);
  });

  test("container strip shows per-container runtime stats (ctop slice)", async ({ page }) => {
    await gotoMatrix(page);
    await expect(page.getByTestId("container-strip")).toBeVisible();
    await expect(page.getByTestId("container-web")).toBeVisible();
    await expect(page.getByTestId("container-postgres")).toBeVisible();
  });

  test("process strip shows supervised process health with restarts marked", async ({ page }) => {
    await gotoMatrix(page);
    await expect(page.getByTestId("process-strip")).toBeVisible();
    await expect(page.getByTestId("process-pty:term-1")).toBeVisible();
    await expect(page.getByTestId("process-restarts-lsp:php:/repo")).toBeVisible();
  });
});

test.describe("matrix workspace — fidelity golden", () => {
  test("matches the dark golden", async ({ page }) => {
    await gotoMatrix(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("matrix-dark.png");
  });

  test("matches the light golden", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    });
    await page.getByTestId("mode-matrix").click();
    await expect(page.getByTestId("matrix-workspace")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("matrix-light.png");
  });
});

test.describe("matrix workspace — a11y (contrast tracked separately)", () => {
  test("no serious/critical axe violations beyond tracked contrast", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await gotoMatrix(page);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
  });
});
