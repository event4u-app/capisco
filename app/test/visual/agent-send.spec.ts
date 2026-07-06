import { test, expect, type Page } from "@playwright/test";

/**
 * Browser chat send-loop behaviour (road-to-shell-and-chat-really-work P2+P5).
 *
 * Against the preview build (no dev bridge → the deterministic mock provider),
 * sending a message must:
 *  - dispatch a mock turn that appends a reply to the transcript (P5), and
 *  - SETTLE the run (the Send button leaves its `data-running` state) rather than
 *    spinning a fake loader forever (P2).
 * This is the exact "chats don't work for real" symptom, now browser-verifiable.
 * (The REAL agent run is native/real-runtime — out of scope here by design.)
 */
async function gotoAgents(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("agent-workspace")).toBeVisible();
}

test("sending in the browser mock streams a reply and settles the run", async ({ page }) => {
  await gotoAgents(page);

  const input = page.getByTestId("composer-input");
  await input.click();
  await input.fill("hello from playwright");
  await page.getByTestId("composer-send").click();

  // P5 — the deterministic mock reply appears in the transcript.
  await expect(
    page.getByTestId("transcript").getByText(/Mock reply — acknowledged/),
  ).toBeVisible({
    timeout: 5000,
  });
  // The user's own turn is shown too (its own message block, fresh page → u1).
  await expect(page.getByTestId("msg-mock-u1")).toContainText("hello from playwright");

  // P2 — the run SETTLED: the Send button is no longer in its running state
  // (no fake infinite spinner). data-running is only present while loading.
  await expect(page.getByTestId("composer-send")).not.toHaveAttribute("data-running", "true");
});
