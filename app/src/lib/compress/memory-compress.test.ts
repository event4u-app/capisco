/**
 * Memory-compression primitive tests (Phase 0, token-economy P0).
 *
 * The HARD A-invariant: protected tokens (code spans, URLs, filesystem paths)
 * are byte-preserved across compression — like caveman-compress. Plus: the
 * ruleset only ever shortens (output ≤ input), never touches negations/numbers,
 * and is deterministic.
 */

import { describe, expect, it } from "vitest";
import { compressMemory, protectedSpans } from "./memory-compress.ts";
import { CAVEMAN_RULESET } from "./caveman-ruleset.ts";

describe("compressMemory — byte-preservation of protected tokens (A-invariant)", () => {
  it("keeps a fenced code block byte-identical", () => {
    const code = "```ts\nconst x = the very actual value;\n```";
    const input = `Here is the code that we just wrote:\n${code}\nand that is all.`;
    const { text } = compressMemory(input);
    expect(text).toContain(code);
  });

  it("keeps inline code, URLs and paths byte-identical", () => {
    const input =
      "The function `doThing(theArg)` lives at /Users/me/app/src/foo.ts " +
      "and the docs are at https://example.com/the/really/long/path?x=1 " +
      "and the config is ./config/app.json just there.";
    const spans = protectedSpans(input);
    const { text } = compressMemory(input);
    // Every protected span survives verbatim.
    for (const span of spans) {
      expect(text).toContain(span);
    }
    // Specifically the load-bearing ones.
    expect(text).toContain("`doThing(theArg)`");
    expect(text).toContain("/Users/me/app/src/foo.ts");
    expect(text).toContain("https://example.com/the/really/long/path?x=1");
    expect(text).toContain("./config/app.json");
  });

  it("preserves a Windows drive path", () => {
    const input = "the file is at C:\\Users\\me\\app\\foo.ts really.";
    const { text } = compressMemory(input);
    expect(text).toContain("C:\\Users\\me\\app\\foo.ts");
  });

  it("never alters a token inside a code span even when it matches a filler word", () => {
    // "the" inside code must stay; "the" in prose is dropped.
    const input = "the value `the` is the answer";
    const { text } = compressMemory(input);
    expect(text).toContain("`the`");
    // The prose "the " occurrences are reduced.
    expect(text.length).toBeLessThan(input.length);
  });
});

describe("compressMemory — reduction behaviour", () => {
  it("drops filler words and shortens output", () => {
    const input = "This is just a really very simple summary of the work that we did.";
    const { text, savedRatio, outputChars, inputChars } = compressMemory(input);
    expect(outputChars).toBeLessThanOrEqual(inputChars);
    expect(savedRatio).toBeGreaterThan(0);
    expect(text).not.toMatch(/\bjust\b/);
    expect(text).not.toMatch(/\breally\b/);
    expect(text).not.toMatch(/\bvery\b/);
  });

  it("contracts verbose phrases", () => {
    const input = "We did it in order to fix the bug due to the fact that it failed.";
    const { text } = compressMemory(input);
    expect(text).toContain("to fix");
    expect(text).toContain("because");
    expect(text).not.toContain("in order to");
    expect(text).not.toContain("due to the fact that");
  });

  it("NEVER removes a negation (load-bearing)", () => {
    const input = "The path is not the default and the value is never empty.";
    const { text } = compressMemory(input);
    expect(text).toContain("not");
    expect(text).toContain("never");
  });

  it("NEVER removes a number", () => {
    const input = "The budget is the 200000 token limit at the 85 percent mark.";
    const { text } = compressMemory(input);
    expect(text).toContain("200000");
    expect(text).toContain("85");
  });

  it("is deterministic — same input, same output", () => {
    const input = "The agent really did just rebuild the very large module again.";
    expect(compressMemory(input).text).toBe(compressMemory(input).text);
  });

  it("handles empty input", () => {
    expect(compressMemory("")).toEqual({
      text: "",
      inputChars: 0,
      outputChars: 0,
      savedRatio: 0,
    });
  });
});

describe("CAVEMAN_RULESET — vendored ruleset shape", () => {
  it("ships a non-trivial, stable rule set with unique ids", () => {
    expect(CAVEMAN_RULESET.length).toBeGreaterThan(10);
    const ids = CAVEMAN_RULESET.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every rule pattern is a global regex (so replace covers all matches)", () => {
    for (const rule of CAVEMAN_RULESET) {
      expect(rule.pattern.flags).toContain("g");
    }
  });
});
