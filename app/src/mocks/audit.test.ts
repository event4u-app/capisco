/**
 * Mock broker-audit store (agent-matrix P0). Append-only contract: record bumps
 * seq, list is a stable snapshot, subscribe fires per append and unsubscribes
 * cleanly. Secret invariant: an entry carries a credentialRef NAME and has no
 * value field.
 */

import { describe, expect, it, vi } from "vitest";
import { createMockAuditStore, mockAuditStore } from "./audit.ts";

describe("mockAuditStore", () => {
  it("seeds deterministic entries with monotonic seq", () => {
    const list = mockAuditStore.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list.map((e) => e.seq)).toEqual(list.map((_, i) => i + 1));
  });

  it("records a secret-read as a credentialRef NAME, never a value", () => {
    const secret = mockAuditStore.list().find((e) => e.capability === "secret-read");
    expect(secret?.credentialRef).toBe("staging-admin");
    // The AuditEntry shape has no value field — a secret value is unrepresentable.
    expect(Object.keys(secret ?? {})).not.toContain("value");
    expect(JSON.stringify(mockAuditStore.list())).not.toMatch(/sk-|ghp_|AKIA|password/i);
  });

  it("record appends with the next seq and returns the frozen entry", () => {
    const store = createMockAuditStore([
      {
        principalId: "you",
        principalKind: "human",
        capability: "shell",
        target: "ls",
        outcome: "allow",
        fromUntrusted: false,
        reason: "allowlist",
      },
    ]);
    const e = store.record({
      principalId: "agent-x",
      principalKind: "agent",
      capability: "file-read",
      target: "src/a.ts",
      outcome: "allow",
      fromUntrusted: false,
      reason: "read ok",
    });
    expect(e.seq).toBe(2);
    expect(store.list().length).toBe(2);
    // Entries are frozen — append-only, no tampering (throws in strict mode).
    expect(() => {
      (e as { outcome: string }).outcome = "deny";
    }).toThrow();
  });

  it("subscribe fires once per record and stops after unsubscribe", () => {
    const store = createMockAuditStore();
    const seen = vi.fn();
    const unsub = store.subscribe(seen);
    store.record({
      principalId: "a",
      principalKind: "agent",
      capability: "shell",
      target: "x",
      outcome: "allow",
      fromUntrusted: false,
      reason: "r",
    });
    expect(seen).toHaveBeenCalledTimes(1);
    unsub();
    store.record({
      principalId: "a",
      principalKind: "agent",
      capability: "shell",
      target: "y",
      outcome: "allow",
      fromUntrusted: false,
      reason: "r",
    });
    expect(seen).toHaveBeenCalledTimes(1); // no further calls after unsubscribe
  });

  it("isolates a throwing observer from the append", () => {
    const store = createMockAuditStore();
    store.subscribe(() => {
      throw new Error("boom");
    });
    expect(() =>
      store.record({
        principalId: "a",
        principalKind: "agent",
        capability: "shell",
        target: "z",
        outcome: "allow",
        fromUntrusted: false,
        reason: "r",
      }),
    ).not.toThrow();
    expect(store.list().length).toBe(1);
  });
});
