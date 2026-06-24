import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import "@/i18n";
import { ThemeProvider } from "@/lib/theme";
import { agentSnapshot, mockAgentProvider, mockIngestProvider } from "@/mocks";
import { AgentWorkspace } from "./AgentWorkspace";
import { useAgents } from "./store";

// The composer adds context through the DesktopShell file-dialog seam, never a
// raw input.click — so we mock the seam and assert the wiring (P1 contract).
// Ingestion itself runs against the real mock provider (the broker-gated
// chokepoint's browser screening twin), so P2 wiring is exercised end-to-end.
vi.mock("@/lib/pick-files", () => ({
  pickFiles: vi.fn().mockResolvedValue([]),
}));
import { pickFiles } from "@/lib/pick-files";

function renderWorkspace() {
  return render(
    <ThemeProvider>
      <div style={{ height: 800 }}>
        <AgentWorkspace />
      </div>
    </ThemeProvider>,
  );
}

function fileWithPath(name: string, path: string): File {
  return Object.assign(new File(["x"], name), { path });
}

function dropFiles(files: File[]) {
  fireEvent.drop(screen.getByTestId("composer-box"), {
    dataTransfer: { files, types: ["Files"] },
  });
}

beforeEach(() => {
  (pickFiles as Mock).mockReset();
  (pickFiles as Mock).mockResolvedValue([]);
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

afterEach(() => vi.clearAllMocks());

describe("Composer — context add via the DesktopShell seam (P1)", () => {
  it("the +-Add button funnels through pickFiles, NOT a raw <input type=file>", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    expect(document.querySelector('input[type="file"]')).toBeNull();
    await user.click(screen.getByTestId("composer-add"));
    expect(pickFiles).toHaveBeenCalledWith({ multiple: true });
  });

  it("a browser-picked file (name only, no path) becomes a plain display chip", async () => {
    (pickFiles as Mock).mockResolvedValue([{ name: "notes.md" }]);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("composer-add"));
    await waitFor(() =>
      expect(
        screen.getAllByTestId("composer-chip").some((c) => c.textContent?.includes("notes.md")),
      ).toBe(true),
    );
  });

  it("a closable chip can be removed", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const before = screen.getAllByTestId("composer-chip").length;
    const chip = screen
      .getAllByTestId("composer-chip")
      .find((c) => c.textContent?.includes("roadmaps-progress.md"))!;
    await user.click(within(chip).getByRole("button"));
    await waitFor(() => expect(screen.getAllByTestId("composer-chip").length).toBe(before - 1));
  });
});

describe("Composer — broker-gated ingestion chokepoint (P2)", () => {
  it("a picked file WITH a path goes through ingest → a referenced context chip", async () => {
    const spy = vi.spyOn(mockIngestProvider, "ingestFile");
    (pickFiles as Mock).mockResolvedValue([{ name: "broker.ts", path: "/repo/src/broker.ts" }]);
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByTestId("composer-add"));
    await waitFor(() => expect(spy).toHaveBeenCalledWith("/repo/src/broker.ts"));
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId("composer-chip")
          .some((c) => c.textContent?.includes("broker.ts")),
      ).toBe(true),
    );
    spy.mockRestore();
  });

  it("Drag&Drop creates a REAL context entry via the SAME ingest path (not just .cmp-drag)", async () => {
    const spy = vi.spyOn(mockIngestProvider, "ingestFile");
    renderWorkspace();
    dropFiles([fileWithPath("app.ts", "/repo/src/app.ts")]);
    // Same chokepoint as +-Add — there is no second ingestion path.
    await waitFor(() => expect(spy).toHaveBeenCalledWith("/repo/src/app.ts"));
    await waitFor(() =>
      expect(
        screen.getAllByTestId("composer-chip").some((c) => c.textContent?.includes("app.ts")),
      ).toBe(true),
    );
    spy.mockRestore();
  });

  it("a secret-form dropped file is REFUSED at the chokepoint (warning chip, never ingested)", async () => {
    renderWorkspace();
    dropFiles([fileWithPath(".env", "/repo/.env.production")]);
    await waitFor(() =>
      expect(
        screen.getByTestId("composer-box").querySelector('[data-refused="true"]'),
      ).toBeTruthy(),
    );
  });
});

describe("Composer — live rules-size warning (P5)", () => {
  it("warns from the LIVE system-context size (same source as the provider), not a hardcoded value", async () => {
    const size = await mockAgentProvider.getSystemContextSize();
    // Summe == System-Context-Länge: the snapshot the composer reads IS the
    // provider's value (one source), not a separate magic number.
    expect(agentSnapshot.systemContext).toEqual(size);
    renderWorkspace();
    const warn = screen.getByTestId("composer-rules-warn");
    expect(warn.getAttribute("aria-label")).toContain(size.chars.toLocaleString());
    expect(warn.getAttribute("aria-label")).toContain(size.limit.toLocaleString());
  });

  it("the warning flips OFF when the loaded rules fit under the real limit", () => {
    const origChars = agentSnapshot.systemContext.chars;
    agentSnapshot.systemContext.chars = 100; // under the 99024 limit
    try {
      renderWorkspace();
      expect(screen.queryByTestId("composer-rules-warn")).toBeNull();
    } finally {
      agentSnapshot.systemContext.chars = origChars;
    }
  });
});
