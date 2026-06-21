import { describe, expect, it } from "vitest";
import type { RecentProject } from "@/contracts";
import { activeMention, insertReference, matchProjects } from "./mention-query";

/** A deterministic seed registry (ordinal lastSeen, no wall-clock). */
const SEED: RecentProject[] = [
  { path: "/w/capisco", name: "capisco", branch: "main", lastSeen: 3, instanceId: "a", active: true },
  { path: "/w/core-api", name: "core-api", branch: "feat/x", lastSeen: 2, instanceId: "b", active: true },
  { path: "/w/design-system", name: "design-system", lastSeen: 1, instanceId: "c", active: false },
  { path: "/w/core-web", name: "core-web", lastSeen: 4, instanceId: "d", active: true },
];

describe("activeMention", () => {
  it("detects a mention at the buffer start", () => {
    expect(activeMention("@core", 5)).toEqual({ query: "core", start: 0, end: 5 });
  });

  it("detects a mention preceded by whitespace", () => {
    expect(activeMention("see @des", 8)).toEqual({ query: "des", start: 4, end: 8 });
  });

  it("returns an empty query right after typing @", () => {
    expect(activeMention("hi @", 4)).toEqual({ query: "", start: 3, end: 4 });
  });

  it("does NOT trigger on an email-ish a@b (no leading whitespace)", () => {
    expect(activeMention("mail@host", 9)).toBeNull();
  });

  it("closes the token at a space", () => {
    expect(activeMention("@core done", 10)).toBeNull();
  });

  it("returns null when the caret is not in a mention", () => {
    expect(activeMention("plain text", 5)).toBeNull();
  });

  it("tracks the caret inside the token, not the end", () => {
    // caret after "@co" of "@core"
    expect(activeMention("@core", 3)).toEqual({ query: "co", start: 0, end: 3 });
  });
});

describe("matchProjects", () => {
  it("ranks most-recent-first by the deterministic lastSeen ordinal", () => {
    const hits = matchProjects(SEED, "");
    expect(hits.map((p) => p.name)).toEqual(["core-web", "capisco", "core-api", "design-system"]);
  });

  it("substring-matches case-insensitively on the name", () => {
    const hits = matchProjects(SEED, "CORE");
    expect(hits.map((p) => p.name)).toEqual(["core-web", "core-api"]);
  });

  it("excludes the current project", () => {
    const hits = matchProjects(SEED, "", "capisco");
    expect(hits.map((p) => p.name)).not.toContain("capisco");
  });

  it("returns empty when nothing matches", () => {
    expect(matchProjects(SEED, "zzz")).toEqual([]);
  });
});

describe("insertReference", () => {
  it("replaces the active mention with a canonical @name reference + trailing space", () => {
    const text = "see @cor";
    const m = activeMention(text, 8)!;
    const out = insertReference(text, m, SEED[1]); // core-api
    expect(out.text).toBe("see @core-api ");
    expect(out.caret).toBe("see @core-api ".length);
  });

  it("preserves text after the caret", () => {
    const text = "@cap rest";
    const m = activeMention(text, 4)!;
    const out = insertReference(text, m, SEED[0]); // capisco
    expect(out.text).toBe("@capisco  rest");
    expect(out.caret).toBe("@capisco ".length);
  });
});
