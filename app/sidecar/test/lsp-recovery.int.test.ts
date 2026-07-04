/**
 * LSP crash- & state-recovery (road-to-real-runtime P3 per-worktree lifecycle +
 * P4 crash-recovery). Two layers, the verification doctrine's "fixture + live":
 *
 *  - DETERMINISTIC (always runs): a fake language server driven through the real
 *    {@link ProcessSupervisor} with an injected spawnFn. Simulates a crash and
 *    asserts the host re-initialises, replays open docs, fails in-flight requests
 *    fast, and serves reads again — no real OS process, fake timers for backoff.
 *  - LIVE / ADVERSARIAL (skips without the server): a real
 *    typescript-language-server is KILLED from the outside (SIGKILL); the host
 *    must detect it, restart through the supervisor, re-sync, and serve reads.
 */

import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LspHost, fileUri } from "../lsp/lsp-host.ts";
import { encode, type JsonRpcMessage } from "../lsp/lsp-jsonrpc.ts";
import { ProcessSupervisor, type SpawnFn } from "../supervisor/process-supervisor.ts";

const R = { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } };

/**
 * A deterministic fake language server: an EventEmitter shaped like the
 * supervisor's child, that decodes the LSP frames written to its stdin and
 * auto-answers `initialize` (so `ready` resolves) and `textDocument/definition`
 * (a canned location). It records `initialize` count + replayed `didOpen` URIs
 * so a restart can be asserted structurally. It deliberately does NOT answer
 * `hover` — that hole is how the in-flight-rejection path is exercised.
 */
class FakeLspChild extends EventEmitter {
  pid = Math.floor(Math.random() * 1e6) + 1;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  initializeCount = 0;
  didOpenUris: string[] = [];
  #in = "";
  stdin = { write: (c: string) => this.#onWrite(c) };
  stdout = new EventEmitter() as EventEmitter & { setEncoding: (e: string) => void };
  stderr = new EventEmitter() as EventEmitter & { setEncoding: (e: string) => void };

  constructor() {
    super();
    this.stdout.setEncoding = () => {};
    this.stderr.setEncoding = () => {};
  }

  #onWrite(chunk: string): void {
    this.#in += chunk;
    for (;;) {
      const headerEnd = this.#in.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const match = /Content-Length:\s*(\d+)/i.exec(this.#in.slice(0, headerEnd));
      if (!match) {
        this.#in = this.#in.slice(headerEnd + 4);
        continue;
      }
      const len = parseInt(match[1], 10);
      const rest = Buffer.from(this.#in.slice(headerEnd + 4), "utf8");
      if (rest.length < len) break;
      const body = rest.subarray(0, len).toString("utf8");
      this.#in = rest.subarray(len).toString("utf8");
      try {
        this.#handle(JSON.parse(body) as JsonRpcMessage);
      } catch {
        /* ignore unparseable */
      }
    }
  }

  #handle(msg: JsonRpcMessage): void {
    if (msg.method === "initialize") {
      this.initializeCount += 1;
      this.#respond(msg.id as number, { capabilities: {} });
    } else if (msg.method === "textDocument/didOpen") {
      const p = msg.params as { textDocument: { uri: string } };
      this.didOpenUris.push(p.textDocument.uri);
    } else if (msg.method === "textDocument/definition") {
      const p = msg.params as { textDocument: { uri: string } };
      this.#respond(msg.id as number, [{ uri: p.textDocument.uri, range: R }]);
    }
    // hover: intentionally unanswered.
  }

  #respond(id: number, result: unknown): void {
    this.stdout.emit("data", encode({ jsonrpc: "2.0", id, result }));
  }

  exit(code: number | null, signal: NodeJS.Signals | null = null): void {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }
  kill(signal: NodeJS.Signals = "SIGTERM"): boolean {
    this.exit(null, signal);
    return true;
  }
}

describe("LspHost crash recovery (deterministic, fake server)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const children: FakeLspChild[] = [];
    const spawnFn: SpawnFn = () => {
      const c = new FakeLspChild();
      children.push(c);
      return c as never;
    };
    const supervisor = new ProcessSupervisor({ spawnFn });
    const restarts: number[] = [];
    const host = new LspHost(
      { id: "lsp:ts:recover", command: "tsserver", args: [], rootPath: "/repo" },
      { supervisor, onRestart: (i) => restarts.push(i.restarts) },
    );
    return { children, host, restarts };
  }

  it("re-initialises and replays open docs after a crash, serving reads again", async () => {
    const { children, host, restarts } = setup();
    await host.ready();
    const uri = fileUri("/repo/a.ts");
    await host.openDoc(uri, "typescript", "const x = 1;");

    expect(children).toHaveLength(1);
    expect(children[0].initializeCount).toBe(1);
    expect(children[0].didOpenUris).toEqual([uri]);
    expect((await host.definition(uri, 0, 0)).length).toBe(1);

    // Crash the server; the supervisor schedules a backoff restart.
    children[0].exit(1);
    await vi.advanceTimersByTimeAsync(250); // > baseDelayMs (200ms)
    await host.ready();

    // A NEW server was spawned, re-initialised, and the doc was replayed.
    expect(children).toHaveLength(2);
    expect(children[1].initializeCount).toBe(1);
    expect(children[1].didOpenUris).toEqual([uri]);
    expect((await host.definition(uri, 0, 0)).length).toBe(1);
    expect(restarts).toEqual([1]);

    host.dispose();
  });

  it("fails in-flight requests fast when the server crashes", async () => {
    const { children, host } = setup();
    await host.ready();
    const uri = fileUri("/repo/a.ts");
    await host.openDoc(uri, "typescript", "x");

    const pending = host.hover(uri, 0, 0); // fake never answers hover
    await Promise.resolve(); // let hover clear `await #ready` and register the request
    await Promise.resolve();
    children[0].exit(1); // crash → in-flight request rejected synchronously

    await expect(pending).rejects.toThrow(/restart/i);
    host.dispose();
  });

  it("does not auto-restart on a clean dispose (no respawn)", async () => {
    const { children, host, restarts } = setup();
    await host.ready();
    host.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(children).toHaveLength(1);
    expect(restarts).toEqual([]);
  });
});

function which(cmd: string): string | undefined {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const p = join(dir, cmd);
    if (p && existsSync(p)) return p;
  }
  return undefined;
}

const server = which("typescript-language-server");
const runLive = server ? it : it.skip;

describe("LspHost crash recovery ↔ real typescript-language-server", () => {
  let dir: string;
  let host: LspHost | undefined;
  const text = ['const greeting = "hello";', "const echo = greeting;", ""].join("\n");

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "capisco-lsprec-"));
  });
  afterEach(() => {
    host?.dispose();
    host = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  async function retry<T>(fn: () => Promise<T[]>): Promise<T[]> {
    let out = await fn();
    for (let i = 0; i < 8 && out.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 300));
      out = await fn();
    }
    return out;
  }

  runLive("recovers from an external SIGKILL and serves reads again", async () => {
    const restarts: number[] = [];
    host = new LspHost(
      { id: "lsp:ts:kill", command: "typescript-language-server", args: ["--stdio"], rootPath: dir },
      { onRestart: (i) => restarts.push(i.restarts) },
    );
    await host.ready();
    const uri = fileUri(join(dir, "sample.ts"));
    await host.openDoc(uri, "typescript", text);

    // Sanity: `greeting` usage on line 1 resolves to its declaration before the kill.
    const before = await retry(() => host!.definition(uri, 1, 13));
    expect(before.length).toBeGreaterThan(0);

    // Adversarial: kill the underlying OS process from the outside.
    const pid = host.pid;
    expect(pid).toBeGreaterThan(0);
    process.kill(pid!, "SIGKILL");

    // The supervisor respawns it; the host re-initialises + replays the doc.
    for (let i = 0; i < 50 && restarts.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(restarts.length).toBeGreaterThan(0);

    // After recovery the doc is open again and reads work.
    const after = await retry(() => host!.definition(uri, 1, 13));
    expect(after.length).toBeGreaterThan(0);
  }, 30_000);
});
