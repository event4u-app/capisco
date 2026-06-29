import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { sentrySnapshot } from "@/mocks/sentry";
import { sanitizeIssueTitle } from "@/lib/sentry-sanitize";
import { SentryWorkspace } from "./SentryWorkspace";

function renderWorkspace() {
  return render(
    <ThemeProvider>
      <div style={{ height: 720 }}>
        <SentryWorkspace />
      </div>
    </ThemeProvider>,
  );
}

describe("SentryWorkspace", () => {
  it("renders the four tabs", () => {
    renderWorkspace();
    expect(screen.getByTestId("sentry-tab-issues")).toBeInTheDocument();
    expect(screen.getByTestId("sentry-tab-crons")).toBeInTheDocument();
    expect(screen.getByTestId("sentry-tab-perf")).toBeInTheDocument();
    expect(screen.getByTestId("sentry-tab-alerts")).toBeInTheDocument();
  });

  it("shows the stats header and a status breadcrumb", () => {
    renderWorkspace();
    expect(screen.getByTestId("sentry-stats")).toBeInTheDocument();
    expect(screen.getByTestId("sentry-crumb")).toHaveTextContent(
      "sentry › issues · production",
    );
  });

  it("lists production/unresolved issues with a level bar and sparkline", () => {
    renderWorkspace();
    // Default filter: production + unresolved → CAP-4F2, CAP-7A9, CAP-2C1.
    const row = screen.getByTestId("sentry-issue-CAP-4F2");
    expect(row.querySelector(".si-bar")).toBeInTheDocument();
    expect(row.querySelector(".spark")).toBeInTheDocument();
    // Staging issue is filtered out by the production env default.
    expect(screen.queryByTestId("sentry-issue-CAP-9B4")).not.toBeInTheDocument();
  });

  it("pipes issue titles through the sanitizer", () => {
    const { container } = renderWorkspace();
    const issue = sentrySnapshot.getAllIssues().find((i) => i.id === "CAP-2C1")!;
    const row = screen.getByTestId("sentry-issue-CAP-2C1");
    expect(within(row).getByText(sanitizeIssueTitle(issue.title))).toBeInTheDocument();
    // No untrusted markup ever reaches the DOM.
    expect(container.querySelector("script")).toBeNull();
    expect(container.innerHTML).not.toContain("<script");
  });

  it("opens an issue detail view on row click and returns via back", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("sentry-issue-CAP-4F2"));
    expect(screen.getByTestId("sentry-detail")).toBeInTheDocument();
    // Write actions are visible but disabled (broker-gated, roadmap P2).
    expect(screen.getByTestId("sentry-detail-resolve")).toBeDisabled();
    expect(screen.getByTestId("sentry-detail-assign")).toBeDisabled();
    await user.click(screen.getByTestId("sentry-detail-back"));
    expect(screen.queryByTestId("sentry-detail")).not.toBeInTheDocument();
  });

  it("switches to crons, performance and alerts tabs", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("sentry-tab-crons"));
    expect(screen.getByTestId("sentry-crons")).toBeInTheDocument();
    expect(screen.getByTestId("sentry-cron-queue-prune-failed")).toBeInTheDocument();
    await user.click(screen.getByTestId("sentry-tab-perf"));
    expect(screen.getByTestId("sentry-perf")).toBeInTheDocument();
    expect(screen.getByTestId("sentry-perf-p95")).toBeInTheDocument();
    await user.click(screen.getByTestId("sentry-tab-alerts"));
    expect(screen.getByTestId("sentry-alerts")).toBeInTheDocument();
    // Two of five rules are on → tab count badge reads 3.
    expect(screen.getByTestId("sentry-alert-0")).toBeInTheDocument();
  });
});
