/**
 * DAP (Debug Adapter Protocol) host (road-to-real-runtime P1).
 *
 * The generic, per-language-pack debug host for adapters that speak DAP over
 * stdio (vscode-js-debug for Node/TS, debugpy for Python, …) — the counterpart
 * to the DBGp bridge (which handles xdebug's connect-back model). The adapter is
 * a long-lived child, so it is spawned THROUGH the P1 {@link ProcessSupervisor}
 * exactly like the LSP server: one spawn primitive, crash-restart for free.
 *
 * DAP shares the LSP `Content-Length`-framed transport; messages are
 * request / response / event keyed by an integer `seq`. {@link DapClient} frames
 * + matches; {@link DapHost} drives the standard launch handshake (initialize →
 * launch/attach → setBreakpoints → configurationDone), tracks the `stopped`
 * event, and exposes stackTrace / scopes / variables / step / continue. Host↔
 * debuggee breakpoint paths are translated by the P0 {@link DapPathMap} — never
 * re-derived.
 *
 * No DAP adapter is bundled here (vscode-js-debug's standalone server is a
 * separate fetch), so the live leg is gated; the protocol + host are verified
 * against an injected fake adapter (fake-conformance, mirroring lsp-recovery).
 */

import {
  ProcessSupervisor,
  type RestartPolicy,
  type SupervisedProcess,
} from "../supervisor/process-supervisor.ts";
import { DapPathMap } from "./dap-path-map.ts";

/** A DAP protocol message (request / response / event), `seq`-keyed. */
export interface DapMessage {
  seq: number;
  type: "request" | "response" | "event";
  // request
  command?: string;
  arguments?: unknown;
  // response
  request_seq?: number;
  success?: boolean;
  message?: string;
  body?: unknown;
  // event
  event?: string;
}

/** Encode a DAP message with the Content-Length header (bytes, like LSP). */
export function encodeDap(msg: DapMessage): string {
  const body = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
}

/** Incremental decoder: feed stdout chunks, get whole DAP messages out. */
export class DapDecoder {
  #buf = "";
  push(chunk: string): DapMessage[] {
    this.#buf += chunk;
    const out: DapMessage[] = [];
    for (;;) {
      const headerEnd = this.#buf.indexOf("\r\n\r\n");
      if (headerEnd < 0) break;
      const header = this.#buf.slice(0, headerEnd);
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        this.#buf = this.#buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const bodyStart = headerEnd + 4;
      const bytes = Buffer.from(this.#buf.slice(bodyStart), "utf8");
      if (bytes.length < len) break; // wait for the rest
      const body = bytes.subarray(0, len).toString("utf8");
      this.#buf = bytes.subarray(len).toString("utf8");
      try {
        out.push(JSON.parse(body) as DapMessage);
      } catch {
        /* skip a malformed frame */
      }
    }
    return out;
  }
  reset(): void {
    this.#buf = "";
  }
}

export interface StoppedInfo {
  reason: string;
  threadId?: number;
}
export interface DapFrame {
  id: number;
  name: string;
  /** Host path (already translated back from the debuggee path). */
  source?: string;
  line: number;
}
export interface DapVariable {
  name: string;
  value: string;
  variablesReference: number;
}

const RESPONSE_TIMEOUT_MS = 15_000;
const DAP_RESTART: RestartPolicy = {
  mode: "on-crash",
  maxRestarts: 5,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
};

export interface DapAdapterSpec {
  /** Stable id, e.g. `dap:js:/repo`. */
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
}

export interface DapHostOptions {
  supervisor?: ProcessSupervisor;
  /** Path translation for breakpoint/frame paths (host↔container). Identity if omitted. */
  pathMap?: DapPathMap;
  /** Fired when the debuggee stops (breakpoint / step / pause) — UI updates here. */
  onStopped?: (info: StoppedInfo) => void;
}

/**
 * Speaks DAP to one adapter spawned through the supervisor. Requests resolve on
 * the matching response (by `request_seq`); `stopped` events fire `onStopped`.
 */
export class DapHost {
  readonly #proc: SupervisedProcess;
  readonly #decoder = new DapDecoder();
  readonly #pending = new Map<
    number,
    { resolve: (m: DapMessage) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  readonly #pathMap: DapPathMap;
  readonly #onStopped?: (info: StoppedInfo) => void;
  #seq = 0;
  #lastThreadId: number | undefined;

  constructor(spec: DapAdapterSpec, opts: DapHostOptions = {}) {
    this.#pathMap = opts.pathMap ?? new DapPathMap(null);
    this.#onStopped = opts.onStopped;
    const supervisor = opts.supervisor ?? new ProcessSupervisor();
    this.#proc = supervisor.spawn(
      { id: spec.id, command: spec.command, args: spec.args, cwd: spec.cwd, restart: DAP_RESTART },
      { onStdout: (chunk) => {
          for (const msg of this.#decoder.push(chunk)) this.#onMessage(msg);
        } },
    );
  }

  #onMessage(msg: DapMessage): void {
    if (msg.type === "response" && typeof msg.request_seq === "number") {
      const pending = this.#pending.get(msg.request_seq);
      if (pending) {
        this.#pending.delete(msg.request_seq);
        clearTimeout(pending.timer);
        if (msg.success === false) pending.reject(new Error(msg.message ?? "DAP request failed"));
        else pending.resolve(msg);
      }
      return;
    }
    if (msg.type === "event" && msg.event === "stopped") {
      const body = (msg.body ?? {}) as { reason?: string; threadId?: number };
      this.#lastThreadId = body.threadId;
      this.#onStopped?.({ reason: body.reason ?? "stopped", threadId: body.threadId });
    }
  }

  /** Send a DAP request, resolving with its response body. */
  request<T = unknown>(command: string, args?: unknown): Promise<T> {
    const seq = ++this.#seq;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(seq);
        reject(new Error(`DAP ${command} timed out`));
      }, RESPONSE_TIMEOUT_MS);
      this.#pending.set(seq, { resolve: (m) => resolve(m.body as T), reject, timer });
      this.#proc.write(encodeDap({ seq, type: "request", command, arguments: args }));
    });
  }

  initialize(): Promise<unknown> {
    return this.request("initialize", { adapterID: "capisco", linesStartAt1: true, pathFormat: "path" });
  }

  launch(args: Record<string, unknown>): Promise<unknown> {
    return this.request("launch", args);
  }

  /** Set line breakpoints in a HOST file; paths are mapped to the debuggee. */
  setBreakpoints(hostPath: string, lines: number[]): Promise<unknown> {
    return this.request("setBreakpoints", {
      source: { path: this.#pathMap.toDebuggee(hostPath) },
      breakpoints: lines.map((line) => ({ line })),
      lines,
    });
  }

  configurationDone(): Promise<unknown> {
    return this.request("configurationDone");
  }

  async stackTrace(threadId = this.#lastThreadId ?? 1): Promise<DapFrame[]> {
    const body = await this.request<{ stackFrames?: Array<{ id: number; name: string; line: number; source?: { path?: string } }> }>(
      "stackTrace",
      { threadId },
    );
    return (body.stackFrames ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      line: f.line,
      // Map the debuggee frame path back to the host file the editor opens.
      source: f.source?.path ? this.#pathMap.toEditor(f.source.path) : undefined,
    }));
  }

  async scopes(frameId: number): Promise<{ name: string; variablesReference: number }[]> {
    const body = await this.request<{ scopes?: Array<{ name: string; variablesReference: number }> }>(
      "scopes",
      { frameId },
    );
    return body.scopes ?? [];
  }

  async variables(variablesReference: number): Promise<DapVariable[]> {
    const body = await this.request<{ variables?: DapVariable[] }>("variables", { variablesReference });
    return body.variables ?? [];
  }

  continue(threadId = this.#lastThreadId ?? 1): Promise<unknown> {
    return this.request("continue", { threadId });
  }
  next(threadId = this.#lastThreadId ?? 1): Promise<unknown> {
    return this.request("next", { threadId });
  }
  stepIn(threadId = this.#lastThreadId ?? 1): Promise<unknown> {
    return this.request("stepIn", { threadId });
  }
  stepOut(threadId = this.#lastThreadId ?? 1): Promise<unknown> {
    return this.request("stepOut", { threadId });
  }

  disconnect(): Promise<unknown> {
    return this.request("disconnect", { terminateDebuggee: true });
  }
}
