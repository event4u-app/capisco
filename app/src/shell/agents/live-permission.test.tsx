import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import type { AgentProvider, PermissionRequest, Session, Unsubscribe } from "@/contracts";
import { scopeToDecision } from "./use-live-permission";

/**
 * LIVE permission UI wiring (road-to-live-permission-gate). Proves that on the
 * bridge-connected path the Transcript surfaces the active session's parked
 * `ask` and that clicking a scope calls `agent.resolvePermission` with the
 * correct {@link PermissionDecision}; a deny maps to `{axis:"deny"}` and clears
 * the prompt. The MOCK path stays inert (covered by AgentWorkspace.test.tsx,
 * which never installs a bridge — the prompt there is the snapshot block).
 */

// Bridge-connected fake: a live agent provider whose getPendingPermission
// returns one parked request; resolvePermission is a spy.
const PENDING: PermissionRequest = {
  id: "live:perm-1",
  command: "file-write(TODO-done.md)",
  label: "TODO-done.md",
  scopes: ["Allow once", "This session", "Deny"],
  fromUntrusted: true,
};

const resolveSpy = vi.fn<(sessionId: string, requestId: string, decision: unknown) => Promise<string>>(
  () => Promise.resolve("once"),
);

let pendingValue: PermissionRequest | null = PENDING;

const fakeAgent = {
  getPendingPermission: () => Promise.resolve(pendingValue),
  resolvePermission: resolveSpy,
  subscribe: (): Unsubscribe => () => {},
} as unknown as AgentProvider;

vi.mock("@/lib/desktop-shell", () => ({
  isDesktop: () => true,
  getProviders: () => ({ agent: fakeAgent }),
}));

// Import AFTER the mock so Transcript's useLivePermission picks up the fake.
const { Transcript } = await import("./Transcript");

const SESSION: Session = {
  id: "s1",
  model: "Stub Agent",
  status: "running",
  title: "Live run",
  telemetry: { tokensIn: 0, tokensOut: 0, runtimeMs: 0 },
};

function renderTranscript() {
  return render(
    <ThemeProvider>
      <div style={{ height: 600 }}>
        <Transcript session={SESSION} runState="ready" onRetry={() => {}} onOpenFile={() => {}} />
      </div>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  resolveSpy.mockClear();
  pendingValue = PENDING;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("scopeToDecision mapping", () => {
  it("maps scope labels to the broker decision axis", () => {
    expect(scopeToDecision("Allow once")).toEqual({ axis: "once" });
    expect(scopeToDecision("This session")).toEqual({ axis: "session" });
    expect(scopeToDecision("Deny")).toEqual({ axis: "deny" });
  });
});

describe("live PermissionPrompt in the Transcript (bridge-connected)", () => {
  it("surfaces the active session's parked ask", async () => {
    renderTranscript();
    const live = await screen.findByTestId("live-permission");
    expect(within(live).getByTestId("permission-command")).toHaveTextContent(
      "file-write(TODO-done.md)",
    );
  });

  it("clicking 'Allow once' resolves with {axis:'once'} for (sessionId, requestId)", async () => {
    const user = userEvent.setup();
    renderTranscript();
    const live = await screen.findByTestId("live-permission");
    await user.click(within(live).getByTestId("permission-scope-0"));
    expect(resolveSpy).toHaveBeenCalledWith("s1", "live:perm-1", { axis: "once" });
  });

  it("clicking 'This session' resolves with {axis:'session'}", async () => {
    const user = userEvent.setup();
    renderTranscript();
    const live = await screen.findByTestId("live-permission");
    await user.click(within(live).getByTestId("permission-scope-1"));
    expect(resolveSpy).toHaveBeenCalledWith("s1", "live:perm-1", { axis: "session" });
  });

  it("clicking 'Deny' resolves with {axis:'deny'} and clears the prompt (no side effect)", async () => {
    const user = userEvent.setup();
    renderTranscript();
    const live = await screen.findByTestId("live-permission");
    // Once denied, no further pending request surfaces.
    pendingValue = null;
    await user.click(within(live).getByTestId("permission-scope-2"));
    expect(resolveSpy).toHaveBeenCalledWith("s1", "live:perm-1", { axis: "deny" });
    // The prompt clears optimistically on resolve.
    await waitFor(() => expect(screen.queryByTestId("live-permission")).not.toBeInTheDocument());
  });
});
