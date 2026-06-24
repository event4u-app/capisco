import { describe, expect, it } from "vitest";
import {
  mockAgentProvider,
  mockChangeSet,
  mockContainerGroups,
  mockDatasources,
  mockProjects,
  mockScratches,
  mockSearch,
  mockSignalProvider,
  mockStructure,
  mockWorkStash,
} from "./index";

describe("mock providers", () => {
  it("expose deterministic sessions implementing the async contract", async () => {
    const a = await mockAgentProvider.listSessions();
    const b = await mockAgentProvider.listSessions();
    expect(a).toEqual(b); // deterministic — no Date.now / Math.random
    expect(a[0]).toMatchObject({ id: "s1", model: "Claude", status: "running" });
    // Telemetry is structured (Phase 1), not a pre-rendered meta string.
    expect(a[0].telemetry).toMatchObject({
      tokensOut: expect.any(Number),
      runtimeMs: expect.any(Number),
    });
    expect((await mockAgentProvider.getPendingPermission("s1"))?.command).toBe(
      "Bash(rm -rf .worktrees/tmp)",
    );
    expect(await mockAgentProvider.getPendingPermission("s2")).toBeNull();
  });

  it("exposes a multi-project explorer tree + global scratches", () => {
    expect(mockProjects.map((p) => p.name)).toContain("capisco-core");
    expect(mockProjects[0].files.some((f) => f.git === "A")).toBe(true);
    // Multiple repos loaded side-by-side (R4 Explorer invariant).
    expect(mockProjects.length).toBeGreaterThanOrEqual(2);
    expect(mockScratches.map((s) => s.name)).toContain("broker-notes.md");
  });

  it("changes default base = PR target when an open PR exists", () => {
    expect(mockChangeSet.hasPullRequest).toBe(true);
    const target = mockChangeSet.branches.find((b) => b.role === "target");
    const parent = mockChangeSet.branches.find((b) => b.role === "parent");
    expect(target?.name).toBe("develop");
    expect(parent?.name).toBe("main");
    expect(mockChangeSet.files.length).toBeGreaterThan(0);
  });

  it("work-stash groups local changes per project + a shelf", () => {
    expect(mockWorkStash.commitBranch).toBe("feat/worktree-teardown");
    expect(mockWorkStash.groups.map((g) => g.project)).toContain("capisco-core");
    expect(mockWorkStash.shelf.length).toBeGreaterThan(0);
  });

  it("search is grouped by file with a long deterministic tail (virtualization)", () => {
    const totalHits = mockSearch.files.reduce((n, f) => n + f.hits.length, 0);
    // > one viewport worth of rows to force windowing in the panel.
    expect(totalHits).toBeGreaterThan(80);
    expect(mockSearch.files[0].hits[0].match).toBe("checkCapability");
  });

  it("structure outline resolves by active-file basename", () => {
    expect(mockStructure("src/core/broker.ts").map((s) => s.kind)).toContain("C");
    expect(mockStructure("broker.ts").length).toBe(8);
    expect(mockStructure("unknown.ts")).toEqual([]); // honest empty state
  });

  it("services are grouped by loaded project (ctop)", () => {
    expect(mockContainerGroups.map((g) => g.project)).toContain("capisco-core");
    const core = mockContainerGroups.find((g) => g.project === "capisco-core")!;
    expect(core.services.some((s) => s.status === "running")).toBe(true);
    expect(core.services.some((s) => s.status === "exited")).toBe(true); // honest mixed state
  });

  it("prod datasource is read-only with a credential REFERENCE, never a value", () => {
    const prod = mockDatasources.find((d) => d.env === "production")!;
    expect(prod.readonly).toBe(true); // invariant §3.3 — derived from env, not a toggle
    // Secret is a reference name only (invariant §2.1) — must not look like a value.
    expect(prod.credentialRef).toBe("prod-readonly");
    expect(prod.credentialRef).not.toMatch(/[:=]|password|token|secret/i);
    // No non-prod datasource is silently read-only.
    expect(
      mockDatasources.filter((d) => d.env !== "production").every((d) => !d.readonly),
    ).toBe(true);
  });

  it("shared signal rail folds every source into ONE SignalItem shape (§5.2)", async () => {
    const signals = await mockSignalProvider.listSignals();
    expect(signals.length).toBeGreaterThan(0);
    // Multiple distinct sources collapse into one rail.
    const sources = new Set(signals.map((s) => s.source));
    expect(sources.size).toBeGreaterThanOrEqual(3);
    expect([...sources]).toEqual(expect.arrayContaining(["pr", "container", "observability"]));

    // The rule side is deliberately dumb (2-3 rules — here a small fixed set).
    const rules = await mockSignalProvider.listRules();
    expect(rules.length).toBeGreaterThanOrEqual(2);
    expect(rules.length).toBeLessThanOrEqual(5);

    // Alerts vs Inspect are two VIEWS of the one rail, partitioned by the rules.
    const alerts = await mockSignalProvider.signalsFor("alerts");
    const inspect = await mockSignalProvider.signalsFor("inspect");
    expect(alerts.length).toBeGreaterThan(0);
    expect(inspect.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.source !== "lint")).toBe(true); // lint routes to inspect
    expect(inspect.every((i) => i.source === "lint")).toBe(true);
  });
});
