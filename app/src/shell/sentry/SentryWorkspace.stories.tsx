import { SentryWorkspace } from "./SentryWorkspace";

/**
 * Sentry workspace (road-to-sentry-observability P0) — the four tabs
 * (Issues / Cron Monitors / Performance / Alerts) backed by the deterministic
 * fixture snapshot. Rendered in a sized dark frame; switch tabs and click an
 * issue row to open its detail view.
 */
export const Workspace = () => (
  <div className="dark h-[680px] w-full bg-editor text-foreground">
    <SentryWorkspace />
  </div>
);

Workspace.storyName = "Sentry workspace — four tabs";
