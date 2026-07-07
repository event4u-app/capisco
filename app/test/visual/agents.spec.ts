import { test, expect, type Page } from "@playwright/test";

// Agents mode is the default landing (store default). DOM/structure assertions
// are the primary autonomy gate (Overview §4(a)); the screenshots are tripwires
// for the strongest fidelity surface (R2).

async function gotoAgents(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("agent-workspace")).toBeVisible();
}

test.describe("agents workspace — structure (primary gate)", () => {
  test("session tabs carry status, model badge, title, meta and close", async ({ page }) => {
    await gotoAgents(page);
    const tab = page.getByTestId("session-tab-s1");
    await expect(tab).toBeVisible();
    await expect(tab).toContainText("Implement worktree teardown");
    await expect(tab.getByRole("status")).toBeVisible(); // StatusDot
    await expect(page.getByTestId("session-meta-s1")).toContainText("2m 49s");
    await expect(page.getByTestId("session-new")).toBeVisible();
    await expect(page.getByTestId("session-gear")).toBeVisible();
  });

  test("subagent row shows child agents as branch chips with a per-node model badge", async ({
    page,
  }) => {
    await gotoAgents(page);
    await expect(page.getByTestId("subagent-row")).toBeVisible();
    await expect(page.getByTestId("subagent-chip-s1a")).toContainText("Subagent · write tests");
    // Model-routing P3: every session-tree node names its model. The subtask
    // runs the small tier (Haiku), distinct from the parent's badge.
    await expect(page.getByTestId("subagent-model-s1a")).toContainText("Haiku 4.8");
  });

  test("chat reading column is centered at ~740px", async ({ page }) => {
    await gotoAgents(page);
    const row = page.getByTestId("transcript").locator("[data-vrow]").first();
    const inner = row.locator(":scope > div");
    const box = await inner.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(740);
    expect(box!.width).toBeGreaterThan(680);
    // Centered: left + right margins inside the scroll container are ~equal.
    const scroll = await page.getByTestId("transcript").boundingBox();
    const leftGap = box!.x - scroll!.x;
    const rightGap = scroll!.x + scroll!.width - (box!.x + box!.width);
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(2);
    // Settled computed cap: the reading column is bounded at exactly 740px.
    const maxW = await inner.evaluate((el) => getComputedStyle(el).maxWidth);
    expect(maxW).toBe("740px");
  });

  test("the broker permission block is present (teal-outline)", async ({ page }) => {
    await gotoAgents(page);
    const prompt = page.getByTestId("permission-prompt");
    await expect(prompt).toBeVisible();
    await expect(page.getByTestId("permission-command")).toContainText(
      "Bash(rm -rf .worktrees/tmp)",
    );
    await expect(prompt.getByTestId("permission-scope-0")).toContainText("Allow once");
    await expect(prompt.getByTestId("permission-scope-2")).toContainText("Deny");
  });

  test("a secret-bearing capability shows the reference, never the value", async ({ page }) => {
    await gotoAgents(page);
    await page.getByTestId("session-select-s3").click();
    const cred = page.getByTestId("permission-credential");
    await expect(cred).toBeVisible();
    await expect(cred).toContainText("credential: staging-admin");
    // No "allow permanently" scope for prod; only per-command scopes.
    const note = page.getByTestId("permission-prod-note");
    await expect(note).toContainText("read-only");
  });

  test("session tabs are a fixed 36px tall; long titles trim with an ellipsis", async ({
    page,
  }) => {
    await gotoAgents(page);
    const tab = page.getByTestId("session-tab-s1");
    const box = await tab.boundingBox();
    expect(Math.round(box!.height)).toBe(36);
    const title = page.getByTestId("session-title-s1");
    const { overflow, ellipsis } = await title.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { overflow: cs.overflow, ellipsis: cs.textOverflow };
    });
    expect(overflow).toContain("hidden");
    expect(ellipsis).toBe("ellipsis");
  });

  test("composer bar exposes auto-routing, tune (effort+budget) and meter controls", async ({
    page,
  }) => {
    await gotoAgents(page);
    await expect(page.getByTestId("composer-input")).toBeVisible();
    await expect(page.getByTestId("composer-send")).toBeVisible();
    // "Auto" is the model-routing control — NOT a model picker (token-economy
    // definition). The effective model is the ModelBadge on the session tab.
    await expect(page.getByTestId("composer-auto")).toBeVisible();
    await expect(page.getByTestId("composer-model")).toHaveCount(0);
    // Effort + budget were consolidated into one "tune" control; budget lives in the meter.
    await expect(page.getByTestId("composer-tune")).toBeVisible();
    await expect(page.getByTestId("context-meter")).toBeVisible();
  });
});

test.describe("agents workspace — context-budget meter (Design-Sync P4)", () => {
  test("the meter is the left composer control, green by default", async ({ page }) => {
    await gotoAgents(page);
    const meter = page.getByTestId("context-meter");
    await expect(meter).toBeVisible();
    // 7.7k / 200k default → green (ok). Assert the TONE, not the number.
    await expect(meter).toHaveAttribute("data-tone", "ok");
    await expect(page.getByTestId("context-meter-bar")).toBeVisible();
    // No banner while green.
    await expect(page.getByTestId("context-banner")).toHaveCount(0);
  });

  test("clicking the meter opens the threshold popover (slider + presets) and sets it live", async ({
    page,
  }) => {
    await gotoAgents(page);
    await page.getByTestId("context-meter").click();
    await expect(page.getByTestId("context-meter-pop")).toBeVisible();
    await expect(page.getByTestId("context-budget-slider")).toBeVisible();
    // Picking the smallest preset (100k) crosses no band for 7.7k → still green,
    // but the threshold update is live (popover reflects the new budget).
    await page.getByTestId("context-budget-preset-100000").click();
    await expect(page.getByTestId("context-meter-value")).toContainText("/100k");
  });
});

test.describe("agents workspace — interactions", () => {
  test("new-session menu picks the model first, then creates an empty session", async ({
    page,
  }) => {
    await gotoAgents(page);
    await page.getByTestId("session-new").click();
    await expect(page.getByTestId("session-new-menu")).toBeVisible();
    await page.getByTestId("session-new-opt-GPT-5").click();
    await expect(page.getByTestId("session-tab-n1")).toBeVisible();
    await expect(page.getByTestId("transcript-empty")).toBeVisible();
  });

  test("empty-state suggestions (P3): boot-visible, click fills without sending", async ({
    page,
  }) => {
    await gotoAgents(page);
    // Deterministic rows from the editor + git mocks on an empty composer.
    await expect(page.getByTestId("composer-empty-suggestions")).toBeVisible();
    await expect(page.getByTestId("composer-suggestion-open-file")).toBeVisible();
    await expect(page.getByTestId("composer-suggestion-git-branch")).toBeVisible();

    const input = page.getByTestId("composer-input");
    await expect(input).toHaveValue("");
    await page.getByTestId("composer-suggestion-open-file").click();

    // Fills the composer — never sends (the send button is not in its
    // running/Stop state, and the suggestions vanish once non-empty).
    await expect(input).not.toHaveValue("");
    await expect(page.getByTestId("composer-send")).not.toHaveAttribute("data-running", "true");
    await expect(page.getByTestId("composer-empty-suggestions")).toHaveCount(0);
  });

  test("tune popover opens the 6-step effort slider and lists plan rows", async ({ page }) => {
    await gotoAgents(page);
    await page.getByTestId("composer-tune").click();
    await expect(page.getByTestId("composer-tune-pop")).toBeVisible();
    await expect(page.getByTestId("composer-effort-slider")).toBeVisible();
    await expect(page.getByTestId("plan-row-weekly")).toContainText("Weekly");
  });

  test("gear opens backend settings; API/CLI segments switch", async ({ page }) => {
    await gotoAgents(page);
    await page.getByTestId("session-gear").click();
    await expect(page.getByTestId("agent-settings")).toBeVisible();
    await expect(page.getByTestId("agent-settings-api-body")).toBeVisible();
    await page.getByTestId("agent-settings-cli").click();
    await expect(page.getByTestId("agent-settings-cli-body")).toContainText(
      "/usr/local/bin/claude",
    );
    // Esc closes (focus trap / keyboard).
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("agent-settings")).toHaveCount(0);
  });

  test("backend picker lists backends; stub is the default, ACP install is broker-gated", async ({
    page,
  }) => {
    await gotoAgents(page);
    await page.getByTestId("session-gear").click();
    // Backend picker is CLI-tab ONLY — not in the API-client tab.
    await expect(page.getByTestId("agent-settings-backends")).toHaveCount(0);
    await page.getByTestId("agent-settings-cli").click();
    const list = page.getByTestId("agent-settings-backends");
    await expect(list).toBeVisible();

    // Stub / Claude Code native / Claude Code via ACP / Codex all present.
    await expect(page.getByTestId("agent-backend-stub")).toBeVisible();
    await expect(page.getByTestId("agent-backend-claude-native")).toBeVisible();
    await expect(page.getByTestId("agent-backend-claude-code-acp")).toBeVisible();
    await expect(page.getByTestId("agent-backend-codex")).toBeVisible();

    // Deterministic default: the stub is selected + "In use" (disabled).
    await expect(page.getByTestId("agent-backend-stub")).toHaveAttribute(
      "data-selected",
      "true",
    );
    await expect(page.getByTestId("agent-backend-stub-use")).toBeDisabled();

    // Install is broker-gated — clicking surfaces the exact audited command, never silent.
    await page.getByTestId("agent-backend-claude-code-acp-install").click();
    await expect(page.getByTestId("agent-settings-install-gate")).toContainText(
      "npm i -g @zed-industries/claude-code-acp",
    );
    await page.keyboard.press("Escape");
  });

  test("Cmd+Enter sends from the composer (keyboard)", async ({ page }) => {
    await gotoAgents(page);
    const input = page.getByTestId("composer-input");
    await input.click();
    await input.fill("draft a teardown");
    await page.keyboard.press("Meta+Enter");
    await expect(input).toHaveValue("");
  });

  test("transcript is virtualized — only a window of a 500-block session renders", async ({
    page,
  }) => {
    await gotoAgents(page);
    await page.getByTestId("session-select-s4").click();
    const rendered = await page.getByTestId("transcript").locator("[data-vrow]").count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(120); // 500 blocks total, only a window mounted
  });
});

test.describe("agents workspace — fidelity goldens", () => {
  test("matches the dark golden", async ({ page }) => {
    await gotoAgents(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("agents-dark.png");
  });

  test("matches the light golden", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
    });
    await expect(page.getByTestId("agent-workspace")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("agents-light.png");
  });
});

test.describe("agents workspace — a11y (contrast tracked, primary-button contrast verified)", () => {
  test("no serious/critical axe violations beyond tracked contrast", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await gotoAgents(page);
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
    );
    expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
  });

  test("the teal primary scope button renders dark primary-foreground text (good contrast)", async ({
    page,
  }) => {
    // Verifies the deferred DECISIONS.md anomaly in the REAL broker context:
    // the bg-primary button must paint --primary-foreground (dark #0E1413),
    // not a low-contrast grey, atop the teal fill.
    await gotoAgents(page);
    const allowBtn = page.getByTestId("permission-scope-0");
    await expect(allowBtn).toContainText("Allow once");
    // Read the SETTLED colors — the mount-time color transition (DECISIONS.md
    // anomaly) interpolates briefly. The old fixed 30-frame poll RACED the
    // transition on slower CI and read a MID-interpolation colour (flaky ~4.42
    // vs the settled 4.5+). Wait for the transition to actually FINISH instead:
    // let it register (one frame), then await every running animation/transition
    // on the element — deterministic, no frame-budget guess.
    const { color, bg } = await allowBtn.evaluate(async (el) => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await Promise.all(
        (el as HTMLElement).getAnimations().map((a) => a.finished.catch(() => undefined)),
      );
      const cs = getComputedStyle(el as HTMLElement);
      return { color: cs.color, bg: cs.backgroundColor };
    });

    const parse = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const [tr, tg, tb] = parse(color);
    const [br, bg2, bb] = parse(bg);
    const lT = lum([tr, tg, tb]);
    const lB = lum([br, bg2, bb]);
    const ratio = (Math.max(lT, lB) + 0.05) / (Math.min(lT, lB) + 0.05);

    // Text must be the dark foreground (low luminance), not grey.
    expect(lT).toBeLessThan(0.15);
    // And clear AA-large contrast against the teal fill.
    expect(ratio).toBeGreaterThan(4.5);
  });
});
