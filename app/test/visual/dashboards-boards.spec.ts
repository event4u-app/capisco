import { test, expect, type Page } from "@playwright/test";

// R5 Git-Dashboard + Tasks-Workspace + inline-SVG chart primitives.
// DOM/structure assertions on data-testid (plus SVG path/point assertions on
// the charts) are the primary autonomy gate (Overview §4(a)); the screenshots
// are tripwires for the fidelity surface.

async function gotoGit(page: Page) {
  await page.goto("/");
  await page.getByTestId("mode-git").click();
  await expect(page.getByTestId("git-workspace")).toBeVisible();
}

async function gotoTasks(page: Page) {
  await page.goto("/");
  await page.getByTestId("mode-tasks").click();
  await expect(page.getByTestId("tasks-workspace")).toBeVisible();
}

test.describe("Git Dashboard — header, filter, 7 tabs", () => {
  test("header + a per-tab range filter (All/Day/Week/Month + Custom)", async ({ page }) => {
    await gotoGit(page);
    await expect(page.getByTestId("git-workspace")).toContainText("Git Dashboard");
    const range = page.getByTestId("git-range");
    await expect(range).toBeVisible();
    for (const r of ["all", "day", "week", "month", "custom"]) {
      await expect(page.getByTestId(`git-range-${r}`)).toBeVisible();
    }
    // Custom popover opens with date inputs.
    await page.getByTestId("git-range-custom").click();
    await expect(page.getByTestId("git-range-pop")).toBeVisible();
    await expect(page.getByTestId("git-from")).toBeVisible();
    await expect(page.getByTestId("git-to")).toBeVisible();
    await expect(page.getByTestId("git-rangepreset-thisWeek")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("git-range-pop")).toHaveCount(0);
  });

  test("all 7 tabs present", async ({ page }) => {
    await gotoGit(page);
    for (const id of ["mine", "review", "overdue", "team", "overview", "activity", "working"]) {
      await expect(page.getByTestId(`git-tab-${id}`)).toBeVisible();
    }
  });

  test("honest-limits note is always visible", async ({ page }) => {
    await gotoGit(page);
    await expect(page.getByTestId("git-honest-note")).toContainText("Activity, not performance");
    await expect(page.getByTestId("git-honest-note")).toContainText("stays on this machine");
    await expect(page.getByTestId("git-honest-note")).toContainText("never compared across people");
  });
});

test.describe("Git Dashboard — My PRs / Review Requested", () => {
  test("My PRs lists detailed GitHub-style rows (checks, reviewers, labels, +/−)", async ({
    page,
  }) => {
    await gotoGit(page);
    const list = page.getByTestId("git-list-mine");
    await expect(list).toBeVisible();
    const pr = page.getByTestId("git-pr-1284");
    await expect(pr).toBeVisible();
    await expect(pr).toContainText("Worktree teardown");
    await expect(pr).toContainText("#1284");
    await expect(pr).toContainText("feat");
    await expect(pr).toContainText("+128");
    await expect(pr).toContainText("−47");
  });

  test("Review Requested teal-highlights a 'you reviewed before' PR", async ({ page }) => {
    await gotoGit(page);
    await page.getByTestId("git-tab-review").click();
    // #1279 is reviewedByMe → re-review highlight badge.
    const pr = page.getByTestId("git-pr-1279");
    await expect(pr).toHaveAttribute("data-re-review", "true");
    await expect(page.getByTestId("git-pr-1279-rereview")).toContainText("you reviewed before");
    // #1283 is directly requested (not re-review).
    await expect(page.getByTestId("git-pr-1283")).toBeVisible();
  });
});

test.describe("Git Dashboard — Overdue (7 days configurable)", () => {
  test("default threshold = 7 days (NOT 3) and is configurable", async ({ page }) => {
    await gotoGit(page);
    await page.getByTestId("git-tab-overdue").click();
    const sel = page.getByTestId("git-overdue-threshold");
    await expect(sel).toHaveValue("7");
    // At 7d: #1271 (8d), #1279 (9d), #1255 (12d) overdue; #1280 (5d) NOT.
    await expect(page.getByTestId("git-pr-1271")).toBeVisible();
    await expect(page.getByTestId("git-pr-1279")).toBeVisible();
    await expect(page.getByTestId("git-pr-1255")).toBeVisible();
    await expect(page.getByTestId("git-pr-1280")).toHaveCount(0);
    // The "Nd ready" amber badge is rendered.
    await expect(page.getByTestId("git-pr-1271-overdue")).toContainText("8d ready");
    // Lower the threshold to 3 → the 5-day PR now appears.
    await sel.selectOption("3");
    await expect(page.getByTestId("git-pr-1280")).toBeVisible();
  });
});

test.describe("Git Dashboard — Team awareness", () => {
  test("By PR / By branch toggle, overlap warning, cherry-pick", async ({ page }) => {
    await gotoGit(page);
    await page.getByTestId("git-tab-team").click();
    await expect(page.getByTestId("git-team")).toBeVisible();
    await expect(page.getByTestId("team-row-mara")).toBeVisible();
    await expect(page.getByTestId("team-overlap-mara")).toContainText("broker.ts");
    await expect(page.getByTestId("team-cherry-mara")).toContainText("Cherry-pick");
    // By branch hides the PR id in the where-line; the toggle is pressable.
    await page.getByTestId("team-by-branch").click();
    await expect(page.getByTestId("team-by-branch")).toHaveAttribute("aria-pressed", "true");
  });
});

test.describe("Git Dashboard — Overview (DORA + charts) SVG structure", () => {
  test("DORA cards + cycle-time line (polyline + points) + categories donut (arcs)", async ({
    page,
  }) => {
    await gotoGit(page);
    await page.getByTestId("git-tab-overview").click();
    // 3 DORA metric cards.
    await expect(page.getByTestId("git-dora")).toBeVisible();
    await expect(page.getByTestId("metric-Lead Time for Changes")).toContainText("61.4 h");
    await expect(page.getByTestId("metric-Deployment Frequency-delta")).toContainText("410.3%");

    // Cycle-time line chart: a polyline + one circle per data point (13 weeks).
    const line = page.getByTestId("git-cycle-line");
    await expect(line.getByTestId("git-cycle-line-line")).toHaveAttribute("points", /\d/);
    expect(await line.locator('[data-testid^="git-cycle-line-point-"]').count()).toBe(13);

    // PR-categories donut: one arc <circle> per segment + legend percentages.
    const donut = page.getByTestId("git-categories-donut");
    await expect(donut.getByTestId("git-categories-donut-seg-Planned")).toHaveAttribute(
      "stroke-dasharray",
      /\d/,
    );
    await expect(donut.getByTestId("git-categories-donut-legend-Planned")).toContainText("64%");
  });
});

test.describe("Git Dashboard — Activity (weekly lines, languages, commits/day)", () => {
  test("four weekly line charts + language bars + per-day bars", async ({ page }) => {
    await gotoGit(page);
    await page.getByTestId("git-tab-activity").click();
    await expect(page.getByTestId("git-activity-stats")).toContainText("Commits");
    for (const id of ["git-act-commits", "git-act-prs", "git-act-loc", "git-act-reviews"]) {
      await expect(page.getByTestId(`${id}-line`)).toHaveAttribute("points", /\d/);
    }
    await expect(page.getByTestId("git-lang-TypeScript")).toContainText("62%");
    expect(await page.getByTestId("git-perday").locator("> div").count()).toBe(7);
  });
});

test.describe("Git Dashboard — Working Times heatmap", () => {
  test("7×24 grid recolours live as the working-hours selector changes", async ({ page }) => {
    await gotoGit(page);
    await page.getByTestId("git-tab-working").click();
    const hm = page.getByTestId("git-heatmap");
    await expect(hm).toBeVisible();
    // 7 rows.
    for (let d = 0; d < 7; d++) await expect(page.getByTestId(`git-heatmap-row-${d}`)).toBeVisible();
    // 7×24 = 168 cells.
    expect(await hm.locator('[data-testid^="git-heatmap-cell-"]').count()).toBe(168);

    // Default core 9–17: Tuesday 10:00 is a CORE cell (not off).
    const tue10 = page.getByTestId("git-heatmap-cell-1-10");
    await expect(tue10).not.toHaveAttribute("data-off", "true");
    // Move the start to 11:00 → the 10:00 cell becomes off-hours (red, data-off).
    await page.getByTestId("git-core-start").selectOption("11");
    await expect(tue10).toHaveAttribute("data-off", "true");
  });
});

test.describe("Tasks workspace — Board / My Tickets / Active / Insights", () => {
  test("tabbar with an Overview tab + four overview tabs", async ({ page }) => {
    await gotoTasks(page);
    await expect(page.getByTestId("tasks-tab-overview")).toBeVisible();
    await expect(page.getByTestId("tasks-overview")).toContainText("Sprint 24");
    for (const id of ["board", "mine", "active", "insights"]) {
      await expect(page.getByTestId(`tasks-tab-${id}`)).toBeVisible();
    }
  });

  test("Board: status columns × epic swimlanes with rich Linear cards", async ({ page }) => {
    await gotoTasks(page);
    await expect(page.getByTestId("tasks-board")).toBeVisible();
    // 6 status columns.
    for (const c of ["backlog", "todo", "progress", "review", "testing", "done"]) {
      await expect(page.getByTestId(`board-col-head-${c}`)).toBeVisible();
    }
    // 3 epic swimlanes.
    for (const ep of ["broker", "sessions", "shell"]) {
      await expect(page.getByTestId(`board-lane-${ep}`)).toBeVisible();
    }
    // A rich card carries the PR branch + sub-task footer.
    await expect(page.getByTestId("board-card-CAP-142")).toContainText("#1284");
    await expect(page.getByTestId("board-card-CAP-142")).toContainText("2/3");
  });

  test("Insights: dual burndown (ideal dashed + actual solid + today marker)", async ({ page }) => {
    await gotoTasks(page);
    await page.getByTestId("tasks-tab-insights").click();
    await expect(page.getByTestId("tasks-insights")).toBeVisible();

    // Sprint burndown: two polylines (ideal dashed, actual solid) + today marker.
    const sb = page.getByTestId("tasks-sprint-burndown");
    await expect(sb.getByTestId("tasks-sprint-burndown-ideal")).toHaveAttribute(
      "stroke-dasharray",
      "4 4",
    );
    await expect(sb.getByTestId("tasks-sprint-burndown-actual")).toHaveAttribute("points", /\d/);
    await expect(sb.getByTestId("tasks-sprint-burndown-today")).toBeVisible();

    // Private burndown is a second, distinct burndown chart.
    const mb = page.getByTestId("tasks-my-burndown");
    await expect(mb.getByTestId("tasks-my-burndown-ideal")).toHaveAttribute("stroke-dasharray", "4 4");
    await expect(mb.getByTestId("tasks-my-burndown-actual")).toHaveAttribute("points", /\d/);

    // My-WIP line, Team-WIP bars, reviews/day line, throughput bars, work-type donut.
    await expect(page.getByTestId("tasks-mywip-line-line")).toHaveAttribute("points", /\d/);
    await expect(page.getByTestId("tasks-teamwip")).toContainText("you");
    await expect(page.getByTestId("tasks-reviews-line-line")).toHaveAttribute("points", /\d/);
    expect(await page.getByTestId("tasks-throughput").locator("> div").count()).toBe(7);
    await expect(page.getByTestId("tasks-worktype-donut-seg-Feature")).toBeVisible();
  });
});

test.describe("Tasks workspace — ticket detail tab", () => {
  test("opening a card opens a closable detail tab with editable description + composer", async ({
    page,
  }) => {
    await gotoTasks(page);
    // Open CAP-142 from the board.
    await page.getByTestId("board-card-CAP-142").click();
    await expect(page.getByTestId("tasks-tab-CAP-142")).toBeVisible();
    const detail = page.getByTestId("ticket-detail-CAP-142");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText("Worktree teardown");

    // Sidebar carries Create branch + Start in a worktree.
    await expect(page.getByTestId("ticket-create-branch-CAP-142")).toContainText("Create branch");
    await expect(page.getByTestId("ticket-start-worktree-CAP-142")).toContainText("worktree");

    // Editable description: Edit → textarea appears.
    await page.getByTestId("ticket-edit-CAP-142").click();
    await expect(page.getByTestId("ticket-desc-edit-CAP-142")).toBeVisible();
    await page.getByTestId("ticket-edit-CAP-142").click();

    // Composer ⌘↵ posts a comment.
    const composer = page.getByTestId("ticket-composer-CAP-142");
    await composer.fill("Looks good, shipping.");
    await composer.press("Meta+Enter");
    await expect(page.getByTestId("ticket-comments-CAP-142")).toContainText("Looks good, shipping.");

    // Close the tab → falls back to Overview.
    await page.getByTestId("tasks-tab-close-CAP-142").click();
    await expect(page.getByTestId("tasks-tab-CAP-142")).toHaveCount(0);
    await expect(page.getByTestId("tasks-overview")).toBeVisible();
  });
});

test.describe("Dashboards a11y (contrast tracked separately)", () => {
  test("no serious/critical axe violations beyond tracked contrast", async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    // Git overview (charts) + Tasks insights (burndowns) are the dense surfaces.
    await gotoGit(page);
    await page.getByTestId("git-tab-overview").click();
    let results = await new AxeBuilder({ page }).analyze();
    let blocking = results.violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
    );
    expect(blocking, `git: ${JSON.stringify(blocking.map((v) => v.id))}`).toEqual([]);

    await gotoTasks(page);
    await page.getByTestId("tasks-tab-insights").click();
    results = await new AxeBuilder({ page }).analyze();
    blocking = results.violations.filter(
      (v) => ["serious", "critical"].includes(v.impact ?? "") && v.id !== "color-contrast",
    );
    expect(blocking, `tasks: ${JSON.stringify(blocking.map((v) => v.id))}`).toEqual([]);
  });
});

test.describe("Dashboards — fidelity goldens", () => {
  test("Git Overview matches the dark golden", async ({ page }) => {
    await gotoGit(page);
    await page.getByTestId("git-tab-overview").click();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("git-overview-dark.png");
  });

  test("Tasks Insights matches the dark golden", async ({ page }) => {
    await gotoTasks(page);
    await page.getByTestId("tasks-tab-insights").click();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("tasks-insights-dark.png");
  });
});
