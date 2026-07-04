import { describe, expect, it } from "vitest";
import { filterAndRank, fuzzyScore } from "./filter";
import type { AutocompleteItem } from "./types";

const item = (id: string, label: string, mruScore = 0): AutocompleteItem => ({
  id,
  label,
  mruScore,
});

describe("filterAndRank", () => {
  it("empty query returns all, MRU-first (Top-Picks)", () => {
    const items = [item("a", "alpha", 1), item("b", "beta", 5), item("c", "gamma", 3)];
    expect(filterAndRank(items, "").map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("substring filters case-insensitively", () => {
    const items = [item("a", "Alpha"), item("b", "Beta"), item("c", "Gamma")];
    expect(filterAndRank(items, "ET").map((i) => i.id)).toEqual(["b"]);
  });

  it("MRU outranks alphabetical among substring matches", () => {
    const items = [item("a", "report-a", 1), item("b", "report-b", 9)];
    expect(filterAndRank(items, "report").map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("alphabetical tiebreak when MRU equal", () => {
    const items = [item("z", "zebra", 2), item("a", "apple", 2)];
    expect(filterAndRank(items, "").map((i) => i.id)).toEqual(["a", "z"]);
  });

  it("substring is the floor — fuzzy never surfaces a non-substring item", () => {
    const items = [item("a", "commit"), item("b", "checkout")];
    // "cmt" is a fuzzy subsequence of "commit" but not a substring → excluded.
    expect(filterAndRank(items, "cmt", { fuzzy: true })).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const items = [item("a", "alpha", 1), item("b", "beta", 5)];
    const before = items.map((i) => i.id);
    filterAndRank(items, "");
    expect(items.map((i) => i.id)).toEqual(before);
  });
});

describe("fuzzyScore", () => {
  it("returns 0 when query is not a subsequence", () => {
    expect(fuzzyScore("commit", "xyz")).toBe(0);
  });

  it("rewards contiguous matches over gapped ones", () => {
    expect(fuzzyScore("commit", "com")).toBeGreaterThan(fuzzyScore("commit", "cmt"));
  });
});
