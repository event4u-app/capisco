import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

// Visual-verify harness (concept: the autonomy enabler). Deterministic capture:
// fixed viewport, reduced motion, animations disabled, self-hosted fonts.
export default defineConfig({
  testDir: "./test/visual",
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 880 } },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
