import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { mockAgentProvider, mockRevertProvider } from "@/mocks";
import { AgentWorkspace } from "./AgentWorkspace";
import { useAgents } from "./store";

function renderWorkspace() {
  return render(
    <ThemeProvider>
      <div style={{ height: 800 }}>
        <AgentWorkspace />
      </div>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  localStorage.removeItem("capisco-agents");
  useAgents.setState({
    extra: [],
    closed: [],
    activeId: "s1",
    runStates: {},
    handoffSeeds: {},
    model: "Opus 4.8",
    effort: 3,
    budget: 200_000,
    terseEnabled: true,
    terseLevel: "full",
    terseHintSeen: false,
    routingEnabled: false,
    modelOverrides: {},
    backendKind: "api",
    settingsOpen: false,
    selectedBackendId: "stub",
  });
});

afterEach(() => {
  useAgents.setState({ extra: [], closed: [], activeId: "s1", runStates: {}, settingsOpen: false });
});

describe("AgentWorkspace", () => {
  it("renders session tabs with status, model badge, title and meta", () => {
    renderWorkspace();
    const tab = screen.getByTestId("session-tab-s1");
    expect(within(tab).getByText("Implement worktree teardown")).toBeInTheDocument();
    expect(screen.getByTestId("session-meta-s1")).toHaveTextContent("2m 49s");
  });

  it("shows the subagent row only for sessions that have children", () => {
    renderWorkspace();
    expect(screen.getByTestId("subagent-row")).toBeInTheDocument();
    expect(screen.getByTestId("subagent-chip-s1a")).toHaveTextContent("Subagent · write tests");
  });

  it("each subagent (session-tree node) carries a model badge naming its model (Phase 4 / P3)", () => {
    renderWorkspace();
    // The session-tree node badge shows WHICH model does WHICH task: the parent
    // s1 runs Claude, its circumscribed "write tests" subtask runs the small
    // tier (Haiku) — the transparency the routing feature exposes per node.
    const subModel = screen.getByTestId("subagent-model-s1a");
    expect(subModel).toHaveTextContent("Haiku 4.8");
    // Distinct from the parent session's own badge — same badge component, per node.
    const parentBadge = within(screen.getByTestId("session-tab-s1"));
    expect(parentBadge.getByText("Claude")).toBeInTheDocument();
  });

  it("renders the permission prompt with scope buttons", () => {
    renderWorkspace();
    const prompt = screen.getByTestId("permission-prompt");
    expect(within(prompt).getByTestId("permission-command")).toHaveTextContent(
      "Bash(rm -rf .worktrees/tmp)",
    );
    expect(within(prompt).getByTestId("permission-scope-0")).toHaveTextContent("Allow once");
  });

  it("shows a secret as a credential reference, never a value (invariant §3.2)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-select-s3"));
    const cred = screen.getByTestId("permission-credential");
    expect(cred).toHaveTextContent("credential: staging-admin");
    // No raw secret value leaks into the prompt.
    expect(cred.textContent).not.toMatch(/sk-/);
  });

  it("creates a new session via the new-session menu (model first)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-new"));
    await user.click(screen.getByTestId("session-new-opt-GPT-5"));
    expect(useAgents.getState().extra).toHaveLength(1);
    expect(useAgents.getState().activeId).toBe("n1");
    expect(screen.getByTestId("transcript-empty")).toBeInTheDocument();
  });

  it("closes a session and switches active to a remaining one", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-close-s1"));
    expect(useAgents.getState().closed).toContain("s1");
    expect(screen.queryByTestId("session-tab-s1")).not.toBeInTheDocument();
  });

  it("trims long session titles with an ellipsis (.st-title), keeps the 36px tab height", () => {
    renderWorkspace();
    // Styling is the verbatim prototype CSS: `.st-title` (ellipsis + 160px max),
    // `.session-tabbar` (height var(--tabbar-h) = 36px). The classes are the
    // contract; the px live in capisco-composer.css.
    const title = screen.getByTestId("session-title-s1");
    expect(title.className).toContain("st-title");
    expect(screen.getByTestId("session-tabbar").className).toContain("session-tabbar");
    expect(screen.getByTestId("session-tab-s1").className).toContain("session-tab");
  });

  it("centers the chat reading column at the 740px max (R2 correction)", () => {
    renderWorkspace();
    // Every rendered transcript row wraps its block in the centered reading
    // column (mx-auto max-w-[740px]); this is the settled R2 correction.
    const rows = screen.getByTestId("transcript").querySelectorAll("[data-vrow]");
    expect(rows.length).toBeGreaterThan(0);
    const inner = rows[0].querySelector(":scope > div") as HTMLElement;
    expect(inner.className).toContain("mx-auto");
    expect(inner.className).toContain("max-w-[740px]");
  });

  it("virtualizes the transcript — only a window of a 500-block session renders", async () => {
    expect(await mockAgentProvider.getBlocks("s4")).toHaveLength(500);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-select-s4"));
    const rows = screen.getByTestId("transcript").querySelectorAll("[data-vrow]");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(120);
  });

  it("opens the backend settings popover and switches between API and CLI", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-gear"));
    expect(screen.getByTestId("agent-settings")).toBeInTheDocument();
    expect(screen.getByTestId("agent-settings-api-body")).toBeInTheDocument();
    await user.click(screen.getByTestId("agent-settings-cli"));
    expect(screen.getByTestId("agent-settings-cli-body")).toHaveTextContent("/usr/local/bin/claude");
  });

  it("lists the agent backends with status + actions; the stub is the default in-use backend", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-gear"));
    // Backend picker is CLI-tab ONLY — it must NOT appear in the API-client tab.
    expect(screen.queryByTestId("agent-settings-backends")).toBeNull();
    await user.click(screen.getByTestId("agent-settings-cli"));
    const list = screen.getByTestId("agent-settings-backends");

    // All four backends are present (Stub / native / ACP bridge / Codex).
    expect(within(list).getByTestId("agent-backend-stub")).toBeInTheDocument();
    expect(within(list).getByTestId("agent-backend-claude-native")).toBeInTheDocument();
    expect(within(list).getByTestId("agent-backend-claude-code-acp")).toBeInTheDocument();
    expect(within(list).getByTestId("agent-backend-codex")).toBeInTheDocument();

    // The deterministic stub is ready + the selected default ("In use", disabled).
    expect(screen.getByTestId("agent-backend-stub")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("agent-backend-stub-use")).toBeDisabled();

    // The ACP bridge is installable — Install is broker-gated, never silent.
    const install = screen.getByTestId("agent-backend-claude-code-acp-install");
    expect(install).toBeInTheDocument();
    await user.click(install);
    const gate = screen.getByTestId("agent-settings-install-gate");
    expect(gate).toHaveTextContent("npm i -g @zed-industries/claude-code-acp");
    expect(gate).toHaveTextContent("never silent");

    // The native backend needs a guided setup (link, not an auto-install).
    expect(screen.getByTestId("agent-backend-claude-native-guide")).toHaveAttribute("href");
  });

  it("selecting a ready backend persists the choice", async () => {
    const user = userEvent.setup();
    // The Stub backend is `ready` and selectable; selecting it is a no-op when
    // already in use, so assert the store wiring directly via setSelectedBackend.
    renderWorkspace();
    await user.click(screen.getByTestId("session-gear"));
    expect(useAgents.getState().selectedBackendId).toBe("stub");
    useAgents.getState().setSelectedBackend("claude-code-acp");
    expect(useAgents.getState().selectedBackendId).toBe("claude-code-acp");
    // Persisted under the agents store key.
    expect(localStorage.getItem("capisco-agents")).toContain("claude-code-acp");
  });

  it("the context-budget meter flips tone green → orange → red against the threshold (P4)", () => {
    // PURE projection: used = active session tokens (s1 = 7.7k); we move the
    // budget threshold to cross the bands. Assert the TONE class, not the
    // (volatile) number string.
    const { rerender } = renderWorkspace();
    const meter = () => screen.getByTestId("context-meter");

    useAgents.setState({ budget: 200_000 }); // 7.7k / 200k ≈ 4% → green
    rerender(
      <ThemeProvider>
        <div style={{ height: 800 }}>
          <AgentWorkspace />
        </div>
      </ThemeProvider>,
    );
    expect(meter()).toHaveAttribute("data-tone", "ok");

    useAgents.setState({ budget: 10_000 }); // 7.7k / 10k = 77% → orange
    rerender(
      <ThemeProvider>
        <div style={{ height: 800 }}>
          <AgentWorkspace />
        </div>
      </ThemeProvider>,
    );
    expect(meter()).toHaveAttribute("data-tone", "warn");

    useAgents.setState({ budget: 8_000 }); // 7.7k / 8k ≈ 96% → red + banner
    rerender(
      <ThemeProvider>
        <div style={{ height: 800 }}>
          <AgentWorkspace />
        </div>
      </ThemeProvider>,
    );
    expect(meter()).toHaveAttribute("data-tone", "crit");
    expect(screen.getByTestId("context-banner")).toBeInTheDocument();
  });

  it("the Rot-banner appears at red and dismisses on Keep going (stub, no behaviour wired)", async () => {
    const user = userEvent.setup();
    useAgents.setState({ budget: 8_000 });
    renderWorkspace();
    expect(screen.getByTestId("context-banner")).toBeInTheDocument();
    // Keep going is a pure stub — it dismisses the banner, mutates no sessions.
    const before = useAgents.getState().extra.length;
    await user.click(screen.getByTestId("context-banner-keep"));
    expect(screen.queryByTestId("context-banner")).toBeNull();
    expect(useAgents.getState().extra.length).toBe(before);
  });

  it("the Rot-banner [New session] performs a compressed handoff, never mutating the parent (Phase 1)", async () => {
    const user = userEvent.setup();
    useAgents.setState({ budget: 8_000 }); // s1 ≈ 96% → red banner
    renderWorkspace();
    expect(screen.getByTestId("context-banner")).toBeInTheDocument();

    const parentBefore = useAgents.getState().activeId;
    const extraBefore = useAgents.getState().extra.length;
    await user.click(screen.getByTestId("context-banner-new"));

    // A fresh session was created + made active (human-initiated, no auto-switch).
    const st = useAgents.getState();
    expect(st.extra.length).toBe(extraBefore + 1);
    expect(st.activeId).not.toBe(parentBefore);
    // The new session carries a compressed seed (not a blank restart).
    const seed = st.handoffSeeds[st.activeId];
    expect(seed).toBeDefined();
    expect(seed).toContain("not a fresh start");
    // The seed is rendered in the (otherwise empty) new session transcript.
    expect(await screen.findByTestId("handoff-seed")).toBeInTheDocument();
  });

  it("agent settings exposes the terse control (default ON at full); toggling opts out (Phase 2)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-gear"));
    const terse = screen.getByTestId("agent-settings-terse-toggle");
    expect(terse).toHaveAttribute("aria-checked", "true");
    // The level picker shows full as the active level.
    expect(screen.getByTestId("agent-settings-terse-level-full")).toHaveAttribute("aria-pressed", "true");
    // Opt out via the switch.
    await user.click(terse);
    expect(useAgents.getState().terseEnabled).toBe(false);

    // Switch level to ultra (re-enable first).
    await user.click(screen.getByTestId("agent-settings-terse-toggle"));
    await user.click(screen.getByTestId("agent-settings-terse-level-ultra"));
    expect(useAgents.getState().terseLevel).toBe("ultra");
  });

  it("shows the one-time terse hint on the first terse send, then never again (Phase 2)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(screen.queryByTestId("terse-hint")).toBeNull();
    // First send while terse is on → the hint appears once.
    await user.click(screen.getByTestId("composer-send"));
    expect(await screen.findByTestId("terse-hint")).toBeInTheDocument();
    expect(useAgents.getState().terseHintSeen).toBe(true);
    await user.click(screen.getByTestId("terse-hint-dismiss"));
    expect(screen.queryByTestId("terse-hint")).toBeNull();
    // A second send does NOT re-surface it (seen is sticky).
    await user.click(screen.getByTestId("composer-send"));
    expect(screen.queryByTestId("terse-hint")).toBeNull();
  });

  it("the routing control is OFF by default and toggles on (Phase 4)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("session-gear"));
    const routing = screen.getByTestId("agent-settings-routing-toggle");
    expect(routing).toHaveAttribute("aria-checked", "false");
    await user.click(routing);
    expect(useAgents.getState().routingEnabled).toBe(true);
  });

  it("a per-session model override shows in the session badge (Phase 4, store-driven)", () => {
    // The override PICKER UI was removed to match the prototype (Auto routing is
    // just a toggle, no model dropdown). The store contract + effective-model
    // badge still hold — exercised directly here.
    renderWorkspace();
    const badge = () => within(screen.getByTestId("session-tab-s1"));
    act(() => useAgents.getState().setModelOverride("s1", "Haiku 4.8"));
    expect(useAgents.getState().modelOverrides.s1).toBe("Haiku 4.8");
    expect(badge().getByText("Haiku 4.8")).toBeInTheDocument();
    // "" clears it.
    act(() => useAgents.getState().setModelOverride("s1", ""));
    expect(useAgents.getState().modelOverrides.s1).toBeUndefined();
  });

  it("the meter popover sets the budget threshold live via presets", async () => {
    const user = userEvent.setup();
    useAgents.setState({ budget: 200_000 });
    renderWorkspace();
    await user.click(screen.getByTestId("context-meter"));
    await user.click(screen.getByTestId("context-budget-preset-100000"));
    expect(useAgents.getState().budget).toBe(100_000);
  });

  it("renders empty / loading / error transcript states", async () => {
    renderWorkspace();
    useAgents.setState({ runStates: { s1: "loading" } });
    expect(await screen.findByTestId("transcript-loading")).toBeInTheDocument();
    useAgents.setState({ runStates: { s1: "error" } });
    expect(await screen.findByTestId("transcript-error")).toBeInTheDocument();
  });
});

describe("Send→Stop = real session cancel (P3 / B3 — Cancel-Assert, test 3)", () => {
  it("a run in flight shows Stop; clicking it cancels ONLY this session (parent untouched, no auto-resume)", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    // A run is in flight for the active session, and a sibling/parent session
    // is also loading — cancelling one must never touch the other.
    useAgents.setState({ runStates: { s1: "loading", "s-parent": "loading" } });

    const sendBtn = await screen.findByTestId("composer-send");
    // The send affordance is now Stop (honesty-gate: only with a cancellable run).
    expect(sendBtn).toHaveAttribute("data-running", "true");

    await user.click(sendBtn);

    // B3: this session is back to ready; the parent's run is NOT mutated.
    expect(useAgents.getState().runStates.s1).toBe("ready");
    expect(useAgents.getState().runStates["s-parent"]).toBe("loading");
  });

  it("cancelRun is idempotent and session-scoped (no auto-resume)", () => {
    useAgents.setState({ runStates: { a: "loading", b: "loading" } });
    useAgents.getState().cancelRun("a");
    useAgents.getState().cancelRun("a");
    expect(useAgents.getState().runStates).toMatchObject({ a: "ready", b: "loading" });
  });
});

describe("Revert glyph wires the broker-gated worktree hunk-revert (P4)", () => {
  it("clicking the revert glyph calls revert.revertPath with the tool's target", async () => {
    const spy = vi.spyOn(mockRevertProvider, "revertPath");
    const user = userEvent.setup();
    renderWorkspace();
    // The mock agents session has an `Edit` tool (added/removed) → revert glyph.
    const revertBtns = await screen.findAllByTestId("tool-action-revert");
    await user.click(revertBtns[0]);
    expect(spy).toHaveBeenCalled();
    // The second arg is the file path the hunk-revert targets (never a shell string).
    expect(typeof spy.mock.calls[0][1]).toBe("string");
    spy.mockRestore();
  });
});
