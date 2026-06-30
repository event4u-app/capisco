/**
 * DBGp (xdebug) debug bridge (road-to-real-runtime P1).
 *
 * xdebug is not a child process the sidecar spawns — it is the DEBUGGEE (running
 * inside the worktree container) that connects OUT to an IDE listener. So this
 * bridge is a TCP server: {@link DbgpListener} binds a per-worktree port, and
 * when xdebug connects (driven by `xdebug.client_host`/`client_port` +
 * `start_with_request`), it hands back a {@link DbgpSession} speaking the DBGp
 * protocol — breakpoints, run, step, stack, variable inspection.
 *
 * Path translation is NOT done here: the caller maps host↔container paths via
 * the P0 {@link DapPathMap} (xdebug reports container paths as `file://` uris).
 * This module is pure protocol + socket; the listener is inbound (node:net, the
 * IPC-spine class — not network egress), so it carries no broker-egress concern.
 *
 * DBGp wire format: length-prefixed null-delimited packets `<len>\0<xml>\0` from
 * xdebug; null-terminated `command -i <txid> [args]` to xdebug. Responses are
 * matched to commands by transaction id.
 */

import { createServer, type Server, type Socket } from "node:net";

/** A parsed DBGp `<response>` (the bits the debug flow needs; XML is regular). */
export interface DbgpResponse {
  command: string;
  transactionId: number;
  /** Run/step status: `starting` | `running` | `break` | `stopping` | `stopped`. */
  status?: string;
  reason?: string;
  /** Break location, when the engine stopped (`<xdebug:message filename lineno>`). */
  filename?: string;
  lineno?: number;
  /** Raw response XML (for callers that need a field this struct does not surface). */
  xml: string;
}

/** One stack frame from `stack_get`. */
export interface DbgpFrame {
  level: number;
  filename: string;
  lineno: number;
  where?: string;
}

/** One variable/property from `context_get` / `property_get`. */
export interface DbgpProperty {
  name: string;
  type?: string;
  value?: string;
}

const NULL = "\0";

/** Extract the first attribute `name="…"` from an element string. */
function attr(xml: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(xml);
  return m ? m[1] : undefined;
}

/** Decode a property/value body: unwrap a `<![CDATA[…]]>` if present, then
 * base64-decode when the element declares `encoding="base64"` (xdebug's default
 * for variable values), else return verbatim. */
function decodeValue(elementOpenTag: string, body: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(body);
  const raw = cdata ? cdata[1] : body.trim();
  return /encoding="base64"/.test(elementOpenTag)
    ? Buffer.from(raw, "base64").toString("utf8")
    : raw;
}

/**
 * A live DBGp conversation over one connected xdebug socket. Commands return the
 * parsed response (matched by transaction id); `run`/`step*` resolve when the
 * engine next stops (status `break`) or finishes (`stopping`/`stopped`).
 */
export class DbgpSession {
  readonly #socket: Socket;
  #buf = Buffer.alloc(0);
  #txid = 0;
  readonly #pending = new Map<number, (r: DbgpResponse) => void>();
  /** The engine's init packet (fileuri / language / protocol), read on connect. */
  readonly init: Promise<DbgpResponse>;
  #resolveInit!: (r: DbgpResponse) => void;
  #closed = false;
  #onClose: (() => void) | undefined;

  constructor(socket: Socket) {
    this.#socket = socket;
    this.init = new Promise((res) => (this.#resolveInit = res));
    socket.on("data", (chunk) => this.#onData(chunk));
    socket.on("close", () => {
      this.#closed = true;
      this.#onClose?.();
    });
    socket.on("error", () => {
      /* surfaced via close — the session is done */
    });
  }

  onClose(cb: () => void): void {
    this.#onClose = cb;
  }

  /** Frame and dispatch a DBGp command, resolving with its matched response. */
  #send(command: string, args: string): Promise<DbgpResponse> {
    if (this.#closed) return Promise.reject(new Error("DBGp session closed"));
    const tx = ++this.#txid;
    return new Promise<DbgpResponse>((resolve) => {
      this.#pending.set(tx, resolve);
      this.#socket.write(`${command} -i ${tx}${args ? " " + args : ""}${NULL}`);
    });
  }

  #onData(chunk: Buffer): void {
    this.#buf = Buffer.concat([this.#buf, chunk]);
    // Packets are `<len>\0<xml>\0`. Consume whole packets greedily.
    for (;;) {
      const firstNull = this.#buf.indexOf(0);
      if (firstNull < 0) return;
      const len = Number(this.#buf.subarray(0, firstNull).toString("ascii"));
      const xmlStart = firstNull + 1;
      if (!Number.isFinite(len) || this.#buf.length < xmlStart + len + 1) return; // wait for more
      const xml = this.#buf.subarray(xmlStart, xmlStart + len).toString("utf8");
      this.#buf = this.#buf.subarray(xmlStart + len + 1); // skip trailing \0
      this.#dispatch(xml);
    }
  }

  #dispatch(xml: string): void {
    if (/<init\b/.test(xml)) {
      this.#resolveInit(this.#parse(xml));
      return;
    }
    const res = this.#parse(xml);
    const cb = this.#pending.get(res.transactionId);
    if (cb) {
      this.#pending.delete(res.transactionId);
      cb(res);
    }
  }

  #parse(xml: string): DbgpResponse {
    const msg = /<xdebug:message\b[^>]*>/.exec(xml)?.[0] ?? "";
    return {
      command: attr(xml, "command") ?? "",
      transactionId: Number(attr(xml, "transaction_id") ?? "-1"),
      status: attr(xml, "status"),
      reason: attr(xml, "reason"),
      filename: msg ? attr(msg, "filename") : attr(xml, "filename"),
      lineno: msg && attr(msg, "lineno") ? Number(attr(msg, "lineno")) : undefined,
      xml,
    };
  }

  // ---- DBGp commands (the debug-flow subset) ----

  /** Set a line breakpoint at a `file://` uri (the CONTAINER path xdebug sees). */
  async setBreakpoint(fileUri: string, line: number): Promise<DbgpResponse> {
    return this.#send("breakpoint_set", `-t line -f ${fileUri} -n ${line}`);
  }

  /** Continue until the next breakpoint or program end. */
  run(): Promise<DbgpResponse> {
    return this.#send("run", "");
  }

  stepOver(): Promise<DbgpResponse> {
    return this.#send("step_over", "");
  }
  stepInto(): Promise<DbgpResponse> {
    return this.#send("step_into", "");
  }
  stepOut(): Promise<DbgpResponse> {
    return this.#send("step_out", "");
  }

  /** The current call stack (top frame first). */
  async stackGet(): Promise<DbgpFrame[]> {
    const res = await this.#send("stack_get", "");
    const frames: DbgpFrame[] = [];
    for (const m of res.xml.matchAll(/<stack\b[^>]*>/g)) {
      const tag = m[0];
      frames.push({
        level: Number(attr(tag, "level") ?? "0"),
        filename: attr(tag, "filename") ?? "",
        lineno: Number(attr(tag, "lineno") ?? "0"),
        where: attr(tag, "where"),
      });
    }
    return frames;
  }

  /** Locals (and friends) in a stack frame — name/type/value of each property. */
  async contextGet(stackDepth = 0): Promise<DbgpProperty[]> {
    const res = await this.#send("context_get", `-d ${stackDepth}`);
    const props: DbgpProperty[] = [];
    // Match a <property …>body</property> (non-greedy body; leaf properties).
    for (const m of res.xml.matchAll(/<property\b([^>]*)>([\s\S]*?)<\/property>/g)) {
      const openAttrs = m[1];
      const body = m[2];
      props.push({
        name: attr(`<x ${openAttrs}>`, "name") ?? "",
        type: attr(`<x ${openAttrs}>`, "type"),
        value: decodeValue(openAttrs, body),
      });
    }
    return props;
  }

  /** End the session (DBGp `stop`), then close the socket. */
  async stop(): Promise<void> {
    try {
      await this.#send("stop", "");
    } catch {
      /* engine may already be gone */
    }
    this.#socket.destroy();
  }

  close(): void {
    this.#socket.destroy();
  }
}

/**
 * A per-worktree DBGp listener. Binds a TCP port the container's xdebug connects
 * back to (`xdebug.client_host=host.docker.internal`, `client_port=<port>`), and
 * resolves a {@link DbgpSession} for the first connection. Inbound only.
 */
export class DbgpListener {
  #server: Server | undefined;
  #port = 0;

  /** Start listening; resolves with the bound port (pass to `xdebug.client_port`). */
  listen(port = 0, host = "0.0.0.0"): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      this.#server = server;
      server.once("error", reject);
      server.listen(port, host, () => {
        const addr = server.address();
        this.#port = typeof addr === "object" && addr ? addr.port : port;
        resolve(this.#port);
      });
    });
  }

  get port(): number {
    return this.#port;
  }

  /** Resolve when xdebug connects (one session). Rejects on timeout. */
  accept(timeoutMs = 15_000): Promise<DbgpSession> {
    const server = this.#server;
    if (!server) return Promise.reject(new Error("listener not started"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no xdebug connection")), timeoutMs);
      server.once("connection", (socket: Socket) => {
        clearTimeout(timer);
        resolve(new DbgpSession(socket));
      });
    });
  }

  close(): void {
    this.#server?.close();
    this.#server = undefined;
  }
}
