/**
 * RealSentryProvider tests (SENTRY-BACKEND-SPEC §3).
 *  - PURE unit tests for the issue mapping + signal projection (deterministic).
 *  - INTEGRATION smoke against REAL Sentry when SENTRY_ORG env is set + a
 *    `sentry-token` is in the keychain (else skipped).
 */

import { describe, expect, it } from "vitest";

import {
  createRealSentryProvider,
  relTime,
  toIssue,
  toSignal,
} from "../observability/real-sentry-provider.ts";
import { createSecretStore } from "../broker/create-secret-store.ts";
import { InMemorySecretStore } from "../broker/in-memory-secret-store.ts";

const NOW = Date.parse("2026-06-26T12:00:00Z");

describe("relTime", () => {
  it("renders relative ages", () => {
    expect(relTime("2026-06-26T11:59:30Z", NOW)).toBe("now");
    expect(relTime("2026-06-26T11:30:00Z", NOW)).toBe("30m");
    expect(relTime("2026-06-26T09:00:00Z", NOW)).toBe("3h");
    expect(relTime("2026-06-24T12:00:00Z", NOW)).toBe("2d");
    expect(relTime(undefined, NOW)).toBe("—");
  });
});

describe("toIssue", () => {
  it("maps a Sentry API row to the spec Issue shape", () => {
    const row = {
      shortId: "CAP-4F2",
      level: "error",
      title: "TypeError: x is undefined",
      culprit: "app/foo.ts in bar",
      project: { slug: "capisco-core" },
      tags: { environment: "production" },
      count: "128",
      userCount: 12,
      firstSeen: "2026-06-24T12:00:00Z",
      lastSeen: "2026-06-26T11:30:00Z",
      status: "unresolved",
      stats: {
        "24h": [
          [0, 3],
          [1, 5],
          [2, 0],
        ],
      },
      assignedTo: { name: "Matze" },
    };
    expect(toIssue(row, NOW)).toEqual({
      id: "CAP-4F2",
      level: "error",
      title: "TypeError: x is undefined",
      culprit: "app/foo.ts in bar",
      project: "capisco-core",
      env: "production",
      events: 128,
      users: 12,
      age: "2d",
      lastSeen: "30m",
      status: "unresolved",
      trend: [3, 5, 0],
      assignee: "Matze",
    });
  });
  it("defaults safely (unknown level→error, unassigned→null)", () => {
    const t = toIssue({ shortId: "X-1", title: "boom" }, NOW);
    expect(t.level).toBe("error");
    expect(t.assignee).toBeNull();
    expect(t.events).toBe(0);
    expect(t.trend).toEqual([]);
  });
});

describe("toSignal", () => {
  it("projects an issue onto the observability rail (error→warning sev)", () => {
    const sig = toSignal({
      id: "CAP-4F2",
      level: "error",
      title: "boom",
      culprit: "",
      project: "core",
      env: "production",
      events: 128,
      users: 12,
      age: "2d",
      lastSeen: "30m",
      status: "unresolved",
      trend: [],
      assignee: null,
    });
    expect(sig.source).toBe("observability");
    expect(sig.sev).toBe("warning");
    expect(sig.id).toBe("sentry:CAP-4F2");
    expect(sig.sub).toContain("128 events");
  });
  it("info level → idle sev", () => {
    const sig = toSignal({
      id: "I-1",
      level: "info",
      title: "fyi",
      culprit: "",
      project: "p",
      env: "",
      events: 1,
      users: 0,
      age: "1h",
      lastSeen: "1h",
      status: "unresolved",
      trend: [],
      assignee: null,
    });
    expect(sig.sev).toBe("idle");
  });
});

describe("createRealSentryProvider — auth via the resolver", () => {
  it("builds a token-mode provider when the keychain holds the token", () => {
    const secrets = new InMemorySecretStore();
    secrets.put("sentry-token", "sk-real");
    const sentry = createRealSentryProvider({ org: "acme", secrets });
    expect(sentry.org).toBe("acme");
  });

  it("throws when no auth is available (no token in the keychain)", () => {
    expect(() =>
      createRealSentryProvider({ org: "acme", secrets: new InMemorySecretStore() }),
    ).toThrow(/no auth available/i);
  });
});

describe("RealSentryProvider ↔ real Sentry (integration)", () => {
  const org = process.env.SENTRY_ORG;
  const run = org ? it : it.skip;

  run(
    "lists real issues in the spec shape + projects to signals",
    async () => {
      const secrets = await createSecretStore();
      const sentry = createRealSentryProvider({
        org: org as string,
        secrets,
        baseUrl: process.env.SENTRY_BASE_URL,
      });
      const issues = await sentry.listIssues();
      expect(Array.isArray(issues)).toBe(true);
      for (const i of issues) {
        expect(typeof i.id).toBe("string");
        expect(["error", "warning", "info"]).toContain(i.level);
        expect(["unresolved", "ignored", "resolved"]).toContain(i.status);
      }
      const signals = sentry.toSignals(issues);
      expect(signals.every((s) => s.source === "observability")).toBe(true);
    },
    30_000,
  );
});
