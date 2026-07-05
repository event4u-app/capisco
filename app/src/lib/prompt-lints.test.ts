/**
 * Composer-intelligence S3 — heuristic prompt-lint rules. Pure, deterministic,
 * no model roundtrip. An empty buffer yields no lints (boot-invisible).
 */

import { describe, expect, it } from "vitest";
import { lintPrompt } from "./prompt-lints";

const ids = (v: string, hasAttachments = false) =>
  lintPrompt(v, hasAttachments).map((l) => l.id);

describe("lintPrompt", () => {
  it("returns [] for an empty or whitespace buffer (boot-invisible)", () => {
    expect(lintPrompt("", false)).toEqual([]);
    expect(lintPrompt("   \n ", false)).toEqual([]);
  });

  it("flags a very short prompt", () => {
    expect(ids("hi")).toContain("too-short");
    expect(ids("this is long enough now")).not.toContain("too-short");
  });

  it("flags a vague imperative with no attached context", () => {
    expect(ids("fix the login flow now")).toContain("vague-imperative");
  });

  it("softens the vague-imperative rule when context is attached", () => {
    expect(ids("fix the login flow now", true)).not.toContain("vague-imperative");
  });

  it("flags a short bare question with no context", () => {
    expect(ids("why is this slow?")).toContain("question-no-context");
    expect(ids("why is this slow?", true)).not.toContain("question-no-context");
  });

  it("does not flag a long question as context-less", () => {
    const long = "why does the checkout page take more than five seconds to render?";
    expect(ids(long)).not.toContain("question-no-context");
  });

  it("assigns a severity to every rule", () => {
    for (const l of lintPrompt("fix", false)) {
      expect(["hint", "warn"]).toContain(l.severity);
    }
  });
});
