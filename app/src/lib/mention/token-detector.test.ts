import { describe, expect, it } from "vitest";
import { detectToken } from "./token-detector";

describe("detectToken — @ mentions", () => {
  it("opens at buffer start", () => {
    expect(detectToken("@fo", 3)).toEqual({ trigger: "@", query: "fo", start: 0, end: 3 });
  });

  it("opens after whitespace mid-buffer", () => {
    expect(detectToken("hi @fo", 6)).toEqual({ trigger: "@", query: "fo", start: 3, end: 6 });
  });

  it("does NOT trigger on an email-ish a@b", () => {
    expect(detectToken("a@b", 3)).toBeNull();
  });

  it("keeps a `/` inside an @-token as a path char (not a trigger)", () => {
    expect(detectToken("@org/repo", 9)).toEqual({
      trigger: "@",
      query: "org/repo",
      start: 0,
      end: 9,
    });
  });

  it("returns empty query right after typing @", () => {
    expect(detectToken("@", 1)).toEqual({ trigger: "@", query: "", start: 0, end: 1 });
  });
});

describe("detectToken — / commands", () => {
  it("opens at buffer start", () => {
    expect(detectToken("/com", 4)).toEqual({ trigger: "/", query: "com", start: 0, end: 4 });
  });

  it("opens at the start of a later line", () => {
    expect(detectToken("hi\n/com", 7)).toEqual({
      trigger: "/",
      query: "com",
      start: 3,
      end: 7,
    });
  });

  it("does NOT trigger for a slash mid-line", () => {
    expect(detectToken("hi /com", 7)).toBeNull();
  });

  it("does NOT trigger for a slash inside a path", () => {
    // caret after the second slash segment — this is inside no command
    expect(detectToken("see a/b", 7)).toBeNull();
  });
});

describe("detectToken — the '@ breaks after slash' regression", () => {
  it("an @-mention still opens on a line that begins with a slash-command", () => {
    // Single parser: the leading `/cmd ` does not poison the later `@` token.
    expect(detectToken("/cmd @fil", 9)).toEqual({
      trigger: "@",
      query: "fil",
      start: 5,
      end: 9,
    });
  });

  it("the slash-command token is still detected at its own caret", () => {
    expect(detectToken("/cmd @fil", 4)).toEqual({
      trigger: "/",
      query: "cmd",
      start: 0,
      end: 4,
    });
  });

  it("returns null when the caret is in plain text between the two", () => {
    // caret at index 5 (just after the space, before @) → not inside any token
    expect(detectToken("/cmd @fil", 5)).toBeNull();
  });
});

describe("detectToken — boundaries", () => {
  it("null outside the buffer", () => {
    expect(detectToken("abc", -1)).toBeNull();
    expect(detectToken("abc", 99)).toBeNull();
  });

  it("null in plain text with no trigger", () => {
    expect(detectToken("just words", 10)).toBeNull();
  });
});
