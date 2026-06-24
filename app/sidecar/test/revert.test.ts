/**
 * Code-hunk revert security tests (road-to-composer-context-runtime P4).
 *  2. Revert-Ehrlichkeit — revert discards ONLY the path's working-tree hunk
 *     (git-authoritative `checkout -- <path>`), audited, no side-effect undo.
 *  6. Revert-argv-Isolation — the path is a DISCRETE argv element, never
 *     interpolated into a shell; a path with shell metacharacters cannot inject.
 */

import { describe, expect, it, vi } from "vitest";
import { Broker, DEFAULT_GRANT_CONFIG } from "../broker/index.ts";
import { BrokerReverter } from "../git/broker-reverter.ts";

function makeReverter() {
  const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
  const run = vi.fn().mockResolvedValue(undefined);
  const reverter = new BrokerReverter({
    broker,
    run,
    isRepo: () => Promise.resolve(true),
    resolvePermission: () => ({ axis: "session" }), // human discard clears the gate
  });
  return { broker, run, reverter };
}

describe("Test 2 — Revert-Ehrlichkeit (only the hunk, git-authoritative, audited)", () => {
  it("runs exactly `git checkout -- <path>` and nothing else", async () => {
    const { run, reverter } = makeReverter();
    const out = await reverter.revertPath("/wt/sess-3", "src/core/worktree.ts");
    expect(out).toEqual({ status: "reverted", path: "src/core/worktree.ts" });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("/wt/sess-3", ["checkout", "--", "src/core/worktree.ts"]);
  });

  it("writes a broker audit entry for the revert (before the git call)", async () => {
    const { broker, reverter } = makeReverter();
    await reverter.revertPath("/wt/sess-3", "src/app.ts");
    const entries = broker.audit.list();
    const executed = entries.find((e) => e.capability === "file-write" && e.outcome === "executed");
    expect(executed).toBeDefined();
    expect(executed?.target).toBe("src/app.ts");
  });

  it("is honest when there is no worktree — skipped, never a fake revert", async () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    const run = vi.fn();
    const reverter = new BrokerReverter({ broker, run, isRepo: () => Promise.resolve(false) });
    const out = await reverter.revertPath("/not/a/repo", "x.ts");
    expect(out.status).toBe("skipped");
    expect(run).not.toHaveBeenCalled();
  });

  it("a denied human gate skips the revert (no git call)", async () => {
    const broker = new Broker({ config: DEFAULT_GRANT_CONFIG });
    const run = vi.fn();
    const reverter = new BrokerReverter({
      broker,
      run,
      isRepo: () => Promise.resolve(true),
      resolvePermission: () => ({ axis: "deny" }),
    });
    const out = await reverter.revertPath("/wt", "src/app.ts");
    expect(out.status).toBe("skipped");
    expect(run).not.toHaveBeenCalled();
  });
});

describe("Test 6 — Revert-argv-Isolation (no shell injection)", () => {
  it("passes a metacharacter path as ONE discrete argv element, never interpolated", async () => {
    const { run, reverter } = makeReverter();
    const evil = "; rm -rf / #";
    const out = await reverter.revertPath("/wt", evil);
    expect(out.status).toBe("reverted");
    // The malicious string is a single array element after `--`, not split or
    // interpolated into a command string — execFile/argv makes injection impossible.
    expect(run).toHaveBeenCalledWith("/wt", ["checkout", "--", evil]);
    const args = run.mock.calls[0][1] as string[];
    expect(args[2]).toBe(evil);
    expect(args).toHaveLength(3);
  });
});
