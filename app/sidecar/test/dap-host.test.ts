import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { ProcessSupervisor, type SpawnFn } from "../supervisor/process-supervisor.ts";
import { DapDecoder, DapHost, encodeDap, type DapMessage } from "../runtime/dap.ts";
import { deriveMountMap } from "../runtime/mount-map.ts";
import { DapPathMap } from "../runtime/dap-path-map.ts";

/**
 * road-to-real-runtime P1 — DAP host fake-conformance. No DAP adapter is
 * fetchable here (vscode-js-debug's standalone server needs network), so the
 * protocol + launch handshake + path translation are verified against an
 * injected fake adapter that speaks real DAP over stdio (the lsp-recovery
 * pattern). The live leg (real js-debug for Node/TS) plugs into this unchanged.
 */

/** A fake DAP adapter: a ChildProcess-shaped stdio child that answers DAP. */
class FakeDapAdapter extends EventEmitter {
  pid = 5555;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  readonly requests: DapMessage[] = [];
  readonly #dec = new DapDecoder();
  readonly stdout = new EventEmitter() as EventEmitter & { setEncoding: (e: string) => void };
  readonly stderr = new EventEmitter() as EventEmitter & { setEncoding: (e: string) => void };
  readonly stdin = { write: (s: string): boolean => { for (const r of this.#dec.push(s)) this.#handle(r); return true; } };

  constructor() {
    super();
    this.stdout.setEncoding = () => {};
    this.stderr.setEncoding = () => {};
  }

  #send(msg: DapMessage): void {
    this.stdout.emit("data", encodeDap(msg));
  }

  #handle(req: DapMessage): void {
    this.requests.push(req);
    const ok = (body?: unknown): void =>
      this.#send({ seq: 0, type: "response", request_seq: req.seq, success: true, command: req.command, body });
    switch (req.command) {
      case "initialize":
        ok({ supportsConfigurationDoneRequest: true });
        this.#send({ seq: 0, type: "event", event: "initialized" });
        break;
      case "setBreakpoints":
        ok({ breakpoints: [{ verified: true, line: 10 }] });
        break;
      case "configurationDone":
        ok();
        // The debuggee runs and hits the breakpoint.
        this.#send({ seq: 0, type: "event", event: "stopped", body: { reason: "breakpoint", threadId: 1 } });
        break;
      case "stackTrace":
        ok({ stackFrames: [{ id: 1, name: "main", line: 10, source: { path: "/app/app.js" } }] });
        break;
      case "scopes":
        ok({ scopes: [{ name: "Locals", variablesReference: 1000 }] });
        break;
      case "variables":
        ok({ variables: [{ name: "x", value: "42", variablesReference: 0 }] });
        break;
      default:
        ok();
    }
  }

  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.exitCode = null;
    this.signalCode = signal;
    this.emit("exit", null, signal);
    return true;
  }
}

function hostWithFake(): { host: DapHost; adapter: FakeDapAdapter; stopped: { reason: string }[] } {
  const adapter = new FakeDapAdapter();
  const spawnFn: SpawnFn = () => adapter as never;
  const sup = new ProcessSupervisor({ spawnFn });
  const mount = deriveMountMap({ localWorkspaceFolder: "/host/proj", config: { workspaceFolder: "/app" } });
  const stopped: { reason: string }[] = [];
  const host = new DapHost(
    { id: "dap:js:/host/proj", command: "node", args: ["dapServer.js"] },
    { supervisor: sup, pathMap: new DapPathMap(mount), onStopped: (i) => stopped.push(i) },
  );
  return { host, adapter, stopped };
}

describe("DapHost fake-conformance (generic DAP over the supervisor)", () => {
  it("drives initialize → setBreakpoints → configurationDone → stopped", async () => {
    const { host, adapter, stopped } = hostWithFake();
    await host.initialize();
    await host.setBreakpoints("/host/proj/app.js", [10]);
    await host.configurationDone();

    // The breakpoint path was translated host → debuggee (/app/app.js).
    const bp = adapter.requests.find((r) => r.command === "setBreakpoints");
    expect((bp?.arguments as { source: { path: string } }).source.path).toBe("/app/app.js");
    // The stopped event surfaced through onStopped.
    expect(stopped).toEqual([{ reason: "breakpoint", threadId: 1 }]);
  });

  it("maps a stopped frame's debuggee path back to the host editor path", async () => {
    const { host } = hostWithFake();
    await host.initialize();
    await host.configurationDone();
    const frames = await host.stackTrace();
    expect(frames[0]).toMatchObject({ id: 1, name: "main", line: 10 });
    expect(frames[0].source).toBe("/host/proj/app.js"); // /app/app.js → toEditor
  });

  it("reads scopes + real variable values at the stop", async () => {
    const { host } = hostWithFake();
    await host.initialize();
    await host.configurationDone();
    const frames = await host.stackTrace();
    const scopes = await host.scopes(frames[0].id);
    expect(scopes[0]).toMatchObject({ name: "Locals", variablesReference: 1000 });
    const vars = await host.variables(scopes[0].variablesReference);
    expect(vars.find((v) => v.name === "x")?.value).toBe("42");
  });

  it("propagates a failed DAP response as a rejection", async () => {
    const { host, adapter } = hostWithFake();
    // Make the next request fail.
    const orig = adapter.stdin.write;
    adapter.stdin.write = (s: string) => {
      const msgs = new DapDecoder().push(s);
      for (const m of msgs)
        adapter.stdout.emit(
          "data",
          encodeDap({ seq: 0, type: "response", request_seq: m.seq, success: false, message: "boom", command: m.command }),
        );
      return true;
    };
    await expect(host.initialize()).rejects.toThrow(/boom/);
    adapter.stdin.write = orig;
  });
});
