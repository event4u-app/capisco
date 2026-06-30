import { describe, expect, it, vi } from "vitest";
import type { Command } from "@/shell/command-registry";
import type { ActiveToken } from "@/lib/mention/token-detector";
import {
  ALL_GROUPS,
  CHAT_GROUPS,
  makeCommandProvider,
  type CommandItem,
} from "./command-provider";

function cmd(id: string, group: Command["group"], run = vi.fn()): Command {
  return { id, label: id, group, run };
}

const registered = (): Record<string, Command> => ({
  "context:add": cmd("context:add", "tools"),
  "git:open": cmd("git:open", "view"),
  "mode:agents": cmd("mode:agents", "modes"),
  "composer:stop": cmd("composer:stop", "tools"),
});

describe("makeCommandProvider — getItems", () => {
  it("ALL_GROUPS surfaces every group but never the excluded composer:stop", () => {
    const p = makeCommandProvider({ getRegistered: registered, groupFilter: ALL_GROUPS });
    const ids = (p.getItems("") as CommandItem[]).map((i) => i.id);
    expect(ids).toContain("context:add");
    expect(ids).toContain("git:open");
    expect(ids).toContain("mode:agents");
    expect(ids).not.toContain("composer:stop");
  });

  it("CHAT_GROUPS keeps only `tools`", () => {
    const p = makeCommandProvider({ getRegistered: registered, groupFilter: CHAT_GROUPS });
    const ids = (p.getItems("") as CommandItem[]).map((i) => i.id);
    expect(ids).toEqual(["context:add"]); // tools only, composer:stop excluded
  });

  it("items carry mruScore 0 (engine does substring + alpha in P1)", () => {
    const p = makeCommandProvider({ getRegistered: registered, groupFilter: ALL_GROUPS });
    for (const item of p.getItems("") as CommandItem[]) expect(item.mruScore).toBe(0);
  });
});

describe("makeCommandProvider — onSelect (accept executes, never inserts)", () => {
  const token: ActiveToken = { trigger: "/", query: "context", start: 0, end: 8 };

  it("excises the /query token from the buffer", () => {
    const p = makeCommandProvider({ getRegistered: registered, groupFilter: ALL_GROUPS });
    const item = (p.getItems("") as CommandItem[]).find((i) => i.id === "context:add")!;
    const res = p.onSelect(item, token, "/context rest");
    expect(res.text).toBe(" rest");
    expect(res.caret).toBe(0);
  });

  it("runs the command + onRun via the deferred side-effect, not synchronously", () => {
    const run = vi.fn();
    const onRun = vi.fn();
    const reg = (): Record<string, Command> => ({ "x:y": cmd("x:y", "tools", run) });
    const p = makeCommandProvider({ getRegistered: reg, groupFilter: ALL_GROUPS, onRun });
    const item = (p.getItems("") as CommandItem[])[0];
    const res = p.onSelect(item, { trigger: "/", query: "x", start: 0, end: 2 }, "/x");
    // Not called during onSelect — only when the engine invokes the side-effect.
    expect(run).not.toHaveBeenCalled();
    res.sideEffect?.();
    expect(onRun).toHaveBeenCalledWith(item.command);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
