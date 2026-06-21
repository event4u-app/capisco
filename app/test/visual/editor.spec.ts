import { test, expect, type Page } from "@playwright/test";

// R3 editor + terminal. DOM/structure assertions are the primary autonomy gate
// (Overview §4(a)); the screenshots are tripwires for the fidelity surface.

async function gotoEditor(page: Page) {
  await page.goto("/");
  await page.getByTestId("mode-editor").click();
  await expect(page.getByTestId("editor-workspace")).toBeVisible();
}

test.describe("editor — CM6 shell (Phase 0)", () => {
  test("tab strip carries pinned / dirty / active state", async ({ page }) => {
    await gotoEditor(page);
    const strip = page.getByTestId("editor-tab-strip");
    await expect(strip).toBeVisible();
    // broker.ts ships pinned + active; worktree.ts dirty.
    const broker = page.getByTestId("editor-tab-broker.ts");
    await expect(broker).toHaveAttribute("data-active", "true");
    await expect(broker).toHaveAttribute("data-pinned", "true");
    await expect(page.getByTestId("editor-tab-worktree.ts")).toHaveAttribute("data-dirty", "true");
  });

  test("CodeMirror mounts read-only with the mock doc + gutter", async ({ page }) => {
    await gotoEditor(page);
    const cm = page.getByTestId("cm-editor");
    await expect(cm).toBeVisible();
    await expect(cm).toHaveAttribute("data-file", "broker.ts");
    // Read-only: no editable content.
    await expect(cm.locator(".cm-content")).toHaveAttribute("contenteditable", "false");
    // Line-number gutter + at least one git change bar rendered.
    await expect(cm.locator(".cm-lineNumbers")).toBeVisible();
    expect(await cm.locator(".cm-change-bar").count()).toBeGreaterThan(0);
    // Rainbow brackets coloured (at least one of each depth in view).
    expect(await cm.locator(".cm-bracket-1").count()).toBeGreaterThan(0);
    // Indent guides drawn on indented lines.
    expect(await cm.locator(".cm-indent-guide").count()).toBeGreaterThan(0);
  });

  test("code folding works off the mock provider ranges (fold gutter)", async ({ page }) => {
    await gotoEditor(page);
    const cm = page.getByTestId("cm-editor");
    // Fold gutter present with a chevron per provider fold range (broker.ts: 2).
    await expect(cm.locator(".cm-foldGutter")).toBeVisible();
    const foldMarkers = cm.locator('.cm-foldGutter span[title="Fold line"]');
    // ≥ 2: the mock provider contributes 2 fold ranges for broker.ts.
    expect(await foldMarkers.count()).toBeGreaterThanOrEqual(2);
    // No placeholder until a region is folded.
    expect(await cm.locator(".cm-foldPlaceholder").count()).toBe(0);
    // Click a fold chevron → the provider range collapses to a placeholder.
    await foldMarkers.first().click();
    expect(await cm.locator(".cm-foldPlaceholder").count()).toBeGreaterThan(0);
  });

  test("tab rename via double-click commits a new label", async ({ page }) => {
    await gotoEditor(page);
    const tab = page.getByTestId("editor-tab-types.ts");
    await page.getByTestId("editor-tab-select-types.ts").click();
    await tab.dblclick();
    const input = page.getByTestId("editor-tab-rename-types.ts");
    await expect(input).toBeVisible();
    await input.fill("shared types");
    await input.press("Enter");
    await expect(tab).toContainText("shared types");
  });

  test("pin toggle flips a tab's pinned state", async ({ page }) => {
    await gotoEditor(page);
    const tab = page.getByTestId("editor-tab-worktree.ts");
    await expect(tab).not.toHaveAttribute("data-pinned", "true");
    await page.getByTestId("editor-tab-pin-worktree.ts").click();
    await expect(tab).toHaveAttribute("data-pinned", "true");
  });
});

test.describe("editor — provider outputs (Phase 1, mock providers)", () => {
  test("autocomplete popup lists CompletionItems, first entry teal-selected", async ({ page }) => {
    await gotoEditor(page);
    const ac = page.getByTestId("autocomplete");
    await expect(ac).toBeVisible();
    await expect(page.getByTestId("ac-item-prompt")).toHaveAttribute("data-selected", "true");
    await expect(ac).toContainText("Promise<boolean>");
  });

  test("inlay hints render parameter names as widget decorations", async ({ page }) => {
    await gotoEditor(page);
    const hints = page.getByTestId("inlay-hints");
    await expect(hints).toBeVisible();
    await expect(hints).toContainText("principal:");
    await expect(hints).toContainText("capability:");
  });

  test("inline blame shows author · date · summary on the active line", async ({ page }) => {
    await gotoEditor(page);
    const blame = page.getByTestId("inline-blame");
    await expect(blame).toBeVisible();
    await expect(blame).toContainText("matze");
    await expect(blame).toContainText("feat: add worktree teardown");
  });

  test("social-presence lane shows an avatar + teal bar; click opens the live popup", async ({
    page,
  }) => {
    await gotoEditor(page);
    await expect(page.getByTestId("social-lane")).toBeVisible();
    await expect(page.getByTestId("presence-bar-mara")).toBeVisible();
    await page.getByTestId("presence-avatar-mara").click();
    const pop = page.getByTestId("live-presence-popup");
    await expect(pop).toBeVisible();
    await expect(pop).toContainText("feat/capability-cache");
    await expect(pop).toContainText("#1283");
    await expect(page.getByTestId("live-presence-diff")).toBeVisible();
    await expect(page.getByTestId("cherry-pick")).toContainText("Cherry-pick this block");
    // Esc closes (focus trap / keyboard).
    await page.keyboard.press("Escape");
    await expect(pop).toHaveCount(0);
  });
});

test.describe("terminal — Phase 2", () => {
  async function openTerminal(page: Page) {
    await page.goto("/");
    await page.getByTestId("rail-item-__terminal__").click();
    await expect(page.getByTestId("terminal-panel")).toBeVisible();
  }

  test("renders mock run output with green checks + a caret prompt", async ({ page }) => {
    await openTerminal(page);
    const out = page.getByTestId("terminal-output");
    await expect(out).toContainText("pnpm test core/broker");
    await expect(out).toContainText("3 passed");
    await expect(page.getByTestId("terminal-caret")).toBeVisible();
  });

  test("the caret honours prefers-reduced-motion (blinks normally, static when reduced)", async ({
    page,
  }) => {
    await openTerminal(page);
    // Default (motion allowed): caret animates.
    const caret = page.getByTestId("terminal-caret");
    await expect(caret).not.toHaveAttribute("data-reduced", "true");
    expect(await caret.evaluate((el) => getComputedStyle(el as HTMLElement).animationName)).toBe(
      "capisco-blink",
    );
    // Emulate prefers-reduced-motion: the JS hook flips data-reduced and the
    // blink animation is dropped (no loop), honouring Tischstakes §5.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(caret).toHaveAttribute("data-reduced", "true");
    expect(await caret.evaluate((el) => getComputedStyle(el as HTMLElement).animationName)).toBe(
      "none",
    );
  });

  test("tabs: add (+), close (×), rename (double-click), split/kill icons", async ({ page }) => {
    await openTerminal(page);
    await expect(page.getByTestId("term-split")).toBeVisible();
    await expect(page.getByTestId("term-kill")).toBeVisible();
    // Add a new session.
    await page.getByTestId("term-new").click();
    await expect(page.getByTestId("term-tab-term-1")).toBeVisible();
    // Rename the Local tab.
    const local = page.getByTestId("term-tab-local");
    await local.dblclick();
    const input = page.getByTestId("term-rename-local");
    await input.fill("build");
    await input.press("Enter");
    await expect(local).toContainText("build");
    // Close it.
    await page.getByTestId("term-close-local").click();
    await expect(page.getByTestId("term-tab-local")).toHaveCount(0);
  });
});

test.describe("editor — fidelity goldens", () => {
  test("matches the dark golden", async ({ page }) => {
    await gotoEditor(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("editor-dark.png");
  });

  test("terminal open matches the dark golden", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mode-editor").click();
    await page.getByTestId("rail-item-__terminal__").click();
    await expect(page.getByTestId("terminal-panel")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("editor-terminal-dark.png");
  });
});

test.describe("editor — a11y (contrast tracked separately)", () => {
  test("no serious/critical axe violations beyond tracked contrast", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await gotoEditor(page);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
  });
});
