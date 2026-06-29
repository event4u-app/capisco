// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NodeInspectorHost, type NodeDebugSession } from "../runtime/cdp.ts";

/**
 * road-to-real-runtime P1, JS-Debug (Node) — LIVE, no adapter download.
 *
 * vscode-js-debug's standalone DAP server isn't fetchable here, but Node's own
 * V8 Inspector (`--inspect-brk`, CDP over a WebSocket) gives real Node
 * debugging. This proves the roadmap acceptance for the TS/Node path: set a
 * breakpoint, execution halts inside the function, read the REAL locals, step.
 * Needs only the sidecar's own Node (always present) — runs unconditionally.
 */
const TARGET = `function add(a, b) {
  const sum = a + b;
  return sum;
}
const result = add(1, 2);
console.log(result);
`;
const BP_LINE = 2; // `const sum = a + b;` inside add (a/b bound)

describe("Node V8 inspector (CDP) live debugging", () => {
  let dir: string;
  let host: NodeInspectorHost | undefined;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "capisco-cdp-"));
    writeFileSync(join(dir, "target.js"), TARGET, "utf8");
  });
  afterEach(() => {
    host?.kill();
    host = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  it("halts at a breakpoint inside a function and reads the real locals", async () => {
    const script = join(dir, "target.js");
    host = new NodeInspectorHost({ id: "dbg:node:test", script });
    const session: NodeDebugSession = await host.connect();
    await session.setBreakpoint(script, BP_LINE);

    const pausePromise = session.waitForPause();
    await session.run();
    const pause = await pausePromise;

    expect(pause.topFrame.functionName).toBe("add");
    expect(pause.topFrame.line).toBe(BP_LINE);
    const locals = await session.locals(pause);
    expect(locals.a).toBe("1");
    expect(locals.b).toBe("2");

    await session.resume();
  }, 30_000);

  it("steps to the next line and sees the computed value", async () => {
    const script = join(dir, "target.js");
    host = new NodeInspectorHost({ id: "dbg:node:test2", script });
    const session = await host.connect();
    await session.setBreakpoint(script, BP_LINE);

    const first = session.waitForPause();
    await session.run();
    await first; // paused at line 2 (sum not yet assigned)

    const nextPause = session.waitForPause();
    await session.stepOver();
    const stepped = await nextPause;
    expect(stepped.topFrame.line).toBe(3); // `return sum;`
    const locals = await session.locals(stepped);
    expect(locals.sum).toBe("3");

    await session.resume();
  }, 30_000);
});
