/**
 * Node/TS live debugging via the V8 Inspector (CDP) — road-to-real-runtime P1,
 * the JS-Debug path.
 *
 * vscode-js-debug's standalone DAP server is not fetchable in a network-
 * restricted env, but Node ships its debugger in the runtime: `node
 * --inspect-brk` exposes the Chrome DevTools Protocol (CDP) over a WebSocket.
 * This host spawns the debuggee THROUGH the P1 supervisor, reads the inspector
 * ws URL off its stderr, and speaks CDP directly — breakpoints, pause, step,
 * variable inspection — with NO adapter download. (js-debug is itself a
 * CDP→DAP bridge; for first-party Node debugging we skip the middleman.)
 *
 * {@link CdpClient} is transport-injectable (a {@link CdpChannel}) so the
 * protocol is unit-tested against a fake channel; {@link NodeInspectorHost}
 * wires the real WebSocket + supervised `node --inspect-brk` for the live path.
 * Paths map through the P0 {@link DapPathMap} (identity for host-only Node).
 */

import { ProcessSupervisor, type SupervisedProcess } from "../supervisor/process-supervisor.ts";
import { DapPathMap } from "./dap-path-map.ts";

/** A duplex JSON-message transport to the inspector (a WebSocket in production). */
export interface CdpChannel {
  send(data: string): void;
  onMessage(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

interface CdpPausedFrame {
  functionName: string;
  url: string;
  /** 1-based line (converted from CDP's 0-based location). */
  line: number;
  /** CDP objectId of the frame's local scope (for variable reads). */
  localScopeObjectId?: string;
}
export interface CdpPause {
  reason: string;
  topFrame: CdpPausedFrame;
}

/** A CDP request/response + event client over an injected channel. */
export class CdpClient {
  readonly #channel: CdpChannel;
  #id = 0;
  readonly #pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: Error) => void }>();
  readonly #listeners = new Map<string, Set<(params: unknown) => void>>();

  constructor(channel: CdpChannel) {
    this.#channel = channel;
    channel.onMessage((data) => this.#onMessage(data));
  }

  #onMessage(data: string): void {
    let msg: { id?: number; result?: unknown; error?: { message?: string }; method?: string; params?: unknown };
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (typeof msg.id === "number") {
      const p = this.#pending.get(msg.id);
      if (!p) return;
      this.#pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message ?? "CDP error"));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method) {
      const set = this.#listeners.get(msg.method);
      if (set) for (const cb of set) cb(msg.params);
    }
  }

  send<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = ++this.#id;
    return new Promise<T>((resolve, reject) => {
      this.#pending.set(id, { resolve: (r) => resolve(r as T), reject });
      this.#channel.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method: string, cb: (params: unknown) => void): () => void {
    let set = this.#listeners.get(method);
    if (!set) {
      set = new Set();
      this.#listeners.set(method, set);
    }
    set.add(cb);
    return () => set?.delete(cb);
  }
}

/** A live Node debug session over CDP. Line numbers are 1-based at this API. */
export class NodeDebugSession {
  readonly #cdp: CdpClient;
  readonly #pathMap: DapPathMap;
  #pausedWaiters: ((p: CdpPause) => void)[] = [];
  /** `--inspect-brk` pauses at the entry before user code; we skip that one
   *  (breakpoints are already set by the time it fires) and surface only real
   *  breakpoint / step pauses. */
  #sawEntry = false;

  constructor(cdp: CdpClient, pathMap: DapPathMap = new DapPathMap(null)) {
    this.#cdp = cdp;
    this.#pathMap = pathMap;
    this.#cdp.on("Debugger.paused", (params) => this.#onPaused(params as RawPaused));
  }

  #onPaused(params: RawPaused): void {
    if (!this.#sawEntry) {
      this.#sawEntry = true;
      void this.#cdp.send("Debugger.resume").catch(() => {});
      return;
    }
    const f = params.callFrames?.[0];
    const local = f?.scopeChain?.find((s) => s.type === "local");
    const pause: CdpPause = {
      reason: params.reason ?? "other",
      topFrame: {
        functionName: f?.functionName || "(anonymous)",
        url: f?.url ?? "",
        line: (f?.location?.lineNumber ?? 0) + 1, // CDP 0-based → 1-based
        localScopeObjectId: local?.object?.objectId,
      },
    };
    const waiters = this.#pausedWaiters;
    this.#pausedWaiters = [];
    for (const w of waiters) w(pause);
  }

  /** Enable the debugger domain (call once after connect). */
  async enable(): Promise<void> {
    await this.#cdp.send("Debugger.enable");
    await this.#cdp.send("Runtime.enable");
  }

  /** Set a line breakpoint in a HOST file (mapped to the debuggee path). */
  async setBreakpoint(hostFile: string, line: number): Promise<void> {
    const file = this.#pathMap.toDebuggee(hostFile);
    // Match the file by basename-anchored regex (robust to file:// vs path).
    const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await this.#cdp.send("Debugger.setBreakpointByUrl", {
      lineNumber: line - 1, // 1-based → CDP 0-based
      urlRegex: `${escaped}$`,
      columnNumber: 0,
    });
  }

  /** Release the initial `--inspect-brk` and run to the first breakpoint. */
  run(): Promise<void> {
    return this.#cdp.send<void>("Runtime.runIfWaitingForDebugger").then(() => undefined);
  }

  resume(): Promise<void> {
    return this.#cdp.send<void>("Debugger.resume").then(() => undefined);
  }
  stepOver(): Promise<void> {
    return this.#cdp.send<void>("Debugger.stepOver").then(() => undefined);
  }
  stepInto(): Promise<void> {
    return this.#cdp.send<void>("Debugger.stepInto").then(() => undefined);
  }
  stepOut(): Promise<void> {
    return this.#cdp.send<void>("Debugger.stepOut").then(() => undefined);
  }

  /** Resolve at the next pause (breakpoint / step). */
  waitForPause(): Promise<CdpPause> {
    return new Promise((resolve) => this.#pausedWaiters.push(resolve));
  }

  /** Resume until a pause whose top frame is `functionName` (skips others). */
  async waitForPauseIn(functionName: string, maxHops = 8): Promise<CdpPause> {
    for (let i = 0; i < maxHops; i++) {
      const next = this.waitForPause();
      await this.resume().catch(() => {});
      const pause = await next;
      if (pause.topFrame.functionName === functionName) return pause;
      // not ours — loop continues, resuming again
    }
    throw new Error(`no pause in ${functionName} within ${maxHops} hops`);
  }

  /** Locals of the current top frame: name → string value. */
  async locals(pause: CdpPause): Promise<Record<string, string>> {
    const objectId = pause.topFrame.localScopeObjectId;
    if (!objectId) return {};
    const res = await this.#cdp.send<{ result: RawProp[] }>("Runtime.getProperties", {
      objectId,
      ownProperties: true,
    });
    const out: Record<string, string> = {};
    for (const p of res.result ?? []) {
      if (p.value && "value" in p.value) out[p.name] = String(p.value.value);
      else if (p.value?.description) out[p.name] = p.value.description;
    }
    return out;
  }
}

interface RawPaused {
  reason?: string;
  callFrames?: Array<{
    functionName?: string;
    url?: string;
    location?: { lineNumber?: number };
    scopeChain?: Array<{ type: string; object?: { objectId?: string } }>;
  }>;
}
interface RawProp {
  name: string;
  value?: { value?: unknown; type?: string; description?: string };
}

/** WebSocket-backed {@link CdpChannel} (Node 22+ global WebSocket). */
function webSocketChannel(url: string): Promise<CdpChannel> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () =>
      resolve({
        send: (data) => ws.send(data),
        onMessage: (cb) => {
          ws.onmessage = (ev) => cb(typeof ev.data === "string" ? ev.data : String(ev.data));
        },
        onClose: (cb) => {
          ws.onclose = () => cb();
        },
        close: () => ws.close(),
      });
    ws.onerror = () => reject(new Error("inspector websocket failed"));
  });
}

export interface NodeInspectorOptions {
  supervisor?: ProcessSupervisor;
  pathMap?: DapPathMap;
  /** Node binary (default: the sidecar's own). */
  nodePath?: string;
}

/**
 * Launch a Node script under `--inspect-brk` THROUGH the supervisor, connect to
 * its V8 inspector, and return a live {@link NodeDebugSession}. The supervisor
 * captures stderr; the inspector ws URL is parsed from it.
 */
export class NodeInspectorHost {
  readonly #proc: SupervisedProcess;
  readonly #pathMap: DapPathMap;
  readonly #wsUrl: Promise<string>;

  constructor(spec: { id: string; script: string; args?: string[]; cwd?: string }, opts: NodeInspectorOptions = {}) {
    this.#pathMap = opts.pathMap ?? new DapPathMap(null);
    const supervisor = opts.supervisor ?? new ProcessSupervisor();
    let resolveUrl!: (u: string) => void;
    this.#wsUrl = new Promise<string>((r) => (resolveUrl = r));
    let found = false;
    this.#proc = supervisor.spawn(
      {
        id: spec.id,
        command: opts.nodePath ?? process.execPath,
        args: ["--inspect-brk=127.0.0.1:0", spec.script, ...(spec.args ?? [])],
        cwd: spec.cwd,
        restart: "never",
      },
      {
        onStderr: (chunk) => {
          if (found) return;
          const m = /ws:\/\/[^\s]+/.exec(chunk);
          if (m) {
            found = true;
            resolveUrl(m[0]);
          }
        },
      },
    );
  }

  /** Connect to the inspector and return a debug session (debugger enabled). */
  async connect(): Promise<NodeDebugSession> {
    const url = await this.#wsUrl;
    const channel = await webSocketChannel(url);
    const session = new NodeDebugSession(new CdpClient(channel), this.#pathMap);
    await session.enable();
    return session;
  }

  kill(): void {
    this.#proc.kill();
  }
}
