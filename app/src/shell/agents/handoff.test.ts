/**
 * Red→new-session handoff tests (Phase 1, token-economy) — the Handoff-Assert
 * from the roadmap acceptance:
 *  - a fresh session starts with an EXTRACT (compressed summary) of the old one,
 *  - the carried summary byte-preserves protected tokens (code/paths/URLs),
 *  - the PARENT is NEVER mutated (B3 retry/copy tamper discipline — a handoff
 *    branches forward, never overwrites the origin).
 */

import { describe, expect, it } from "vitest";
import type { Session, TranscriptBlock } from "@/contracts";
import { buildSessionHandoff } from "./handoff.ts";

const PARENT: Session = {
  id: "s1",
  model: "Opus 4.8",
  status: "running",
  title: "Refactor the broker",
  telemetry: { tokensIn: 120_000, tokensOut: 60_000, runtimeMs: 169_000 },
};

const BLOCKS: TranscriptBlock[] = [
  {
    type: "message",
    block: {
      id: "m1",
      role: "user",
      body: "Please refactor the file at /Users/me/app/src/broker.ts to fix the bug.",
    },
  },
  {
    type: "tool",
    block: { id: "t1", kind: "Edit", target: "/Users/me/app/src/broker.ts" },
  },
  {
    type: "message",
    block: {
      id: "m2",
      role: "agent",
      body: "I did just update the very large module; the docs are at https://example.com/broker/guide now.",
    },
  },
];

describe("buildSessionHandoff — Handoff-Assert", () => {
  it("seeds the new session with a compressed extract of the old", () => {
    const { session, summary } = buildSessionHandoff(PARENT, BLOCKS, "n1", "New session");
    // The new session is fresh + lean.
    expect(session.id).toBe("n1");
    expect(session.title).toBe("New session");
    expect(session.model).toBe(PARENT.model);
    expect(session.telemetry).toEqual({ tokensIn: 0, tokensOut: 0, runtimeMs: 0 });
    // The seed carries provenance + a non-empty extract of the old transcript.
    expect(summary.fromSessionId).toBe("s1");
    expect(summary.lineCount).toBe(3);
    expect(summary.text).toContain("not a fresh start");
    expect(summary.text.length).toBeGreaterThan(0);
  });

  it("byte-preserves protected tokens (code/paths/URLs) in the carried summary", () => {
    const { summary } = buildSessionHandoff(PARENT, BLOCKS, "n1", "New session");
    expect(summary.text).toContain("/Users/me/app/src/broker.ts");
    expect(summary.text).toContain("https://example.com/broker/guide");
  });

  it("compresses the carried body (drops filler — saves tokens)", () => {
    const { summary } = buildSessionHandoff(PARENT, BLOCKS, "n1", "New session");
    // "just" and "very" filler are gone from the carried prose.
    expect(summary.text).not.toMatch(/\bjust\b/);
    expect(summary.text).not.toMatch(/\bvery\b/);
    expect(summary.compression.savedRatio).toBeGreaterThan(0);
  });

  it("NEVER mutates the parent session or its blocks", () => {
    const parentBefore = structuredClone(PARENT);
    const blocksBefore = structuredClone(BLOCKS);
    buildSessionHandoff(PARENT, BLOCKS, "n1", "New session");
    expect(PARENT).toEqual(parentBefore);
    expect(BLOCKS).toEqual(blocksBefore);
  });

  it("is deterministic — same input, same handoff", () => {
    const a = buildSessionHandoff(PARENT, BLOCKS, "n1", "New session");
    const b = buildSessionHandoff(PARENT, BLOCKS, "n1", "New session");
    expect(a.summary.text).toBe(b.summary.text);
    expect(a.session).toEqual(b.session);
  });
});
