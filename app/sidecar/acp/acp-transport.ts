/**
 * ACP stdio transport (B3 Phase 1) — a JSON-RPC/NDJSON peer over a child
 * process's stdin/stdout. It spawns an ACP agent (the deterministic
 * `stub-acp-agent.mjs`; a real CLI is a thin swap), sends client→agent requests
 * (`session/new`, `session/prompt`), and dispatches agent→client requests
 * (`session/request_permission`) + id-less notifications (`session/update`) to a
 * handler.
 *
 * The framing reuses {@link NdjsonDecoder} so arbitrary stdout chunk boundaries
 * are tolerated exactly like the socket transport. The peer correlates our
 * outbound request ids with the agent's responses, and routes the agent's
 * inbound requests (it can ASK the client for a capability — the broker seam) to
 * the supplied `onAgentRequest` handler, whose result is sent back as the
 * response.
 */

import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { NdjsonDecoder } from "@/lib/sidecar/protocol/ndjson.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Absolute path to the deterministic stub agent. */
export const STUB_ACP_AGENT_PATH = join(HERE, "stub-acp-agent.mjs");

/** A request the AGENT sends to the client (e.g. session/request_permission). */
export interface AgentRequest {
  method: string;
  params: unknown;
}

/** An id-less notification the agent pushes (session/update). */
export interface AgentNotification {
  method: string;
  params: unknown;
}

export interface AcpTransportOptions {
  /** Command to spawn (defaults to `process.execPath` = node). */
  command?: string;
  /** Args (defaults to `[STUB_ACP_AGENT_PATH]`). */
  args?: string[];
  /**
   * Handle an agent→client request. Its resolved value becomes the JSON-RPC
   * result sent back to the agent. This is where the broker gate lives.
   */
  onAgentRequest: (req: AgentRequest) => Promise<unknown>;
  /** Handle an id-less agent notification (session/update). */
  onNotification: (note: AgentNotification) => void;
}

export class AcpTransport {
  readonly #child: ChildProcessByStdio<Writable, Readable, null>;
  readonly #decoder = new NdjsonDecoder();
  readonly #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  #nextId = 1;
  #closed = false;

  constructor(opts: AcpTransportOptions) {
    const command = opts.command ?? process.execPath;
    const args = opts.args ?? [STUB_ACP_AGENT_PATH];
    this.#child = spawn(command, args, { stdio: ["pipe", "pipe", "inherit"] });
    this.#child.stdout.setEncoding("utf8");
    this.#child.stdout.on("data", (chunk: string) => this.#onData(chunk, opts));
    this.#child.on("close", () => this.#onClose());
  }

  #onData(chunk: string, opts: AcpTransportOptions): void {
    for (const result of this.#decoder.push(chunk)) {
      if (!result.ok) continue; // skip a malformed line, like the socket peer
      const msg = result.message as unknown as Record<string, unknown>;
      const hasId = "id" in msg && msg.id !== undefined;
      const hasMethod = "method" in msg && msg.method !== undefined;

      if (hasMethod && hasId) {
        // Agent → client REQUEST (it wants the client to do something / a perm ask).
        void this.#handleAgentRequest(msg, opts);
      } else if (hasMethod) {
        // Agent → client NOTIFICATION (session/update).
        opts.onNotification({ method: String(msg.method), params: msg.params });
      } else if (hasId) {
        // Response to one of OUR requests.
        this.#resolveResponse(msg);
      }
    }
  }

  async #handleAgentRequest(msg: Record<string, unknown>, opts: AcpTransportOptions): Promise<void> {
    const id = msg.id as number;
    try {
      const result = await opts.onAgentRequest({
        method: String(msg.method),
        params: msg.params,
      });
      this.#write({ jsonrpc: "2.0", id, result });
    } catch (err) {
      this.#write({
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  #resolveResponse(msg: Record<string, unknown>): void {
    const id = msg.id as number;
    const slot = this.#pending.get(id);
    if (!slot) return;
    this.#pending.delete(id);
    if ("error" in msg) {
      const err = msg.error as { message?: string };
      slot.reject(new Error(err.message ?? "agent error"));
    } else {
      slot.resolve(msg.result);
    }
  }

  #onClose(): void {
    this.#closed = true;
    for (const [, slot] of this.#pending) {
      slot.reject(new Error("ACP agent process closed"));
    }
    this.#pending.clear();
  }

  #write(message: unknown): void {
    if (this.#closed) return;
    this.#child.stdin.write(JSON.stringify(message) + "\n");
  }

  /** Send a client→agent request and await its response. */
  request<R = unknown>(method: string, params: unknown): Promise<R> {
    if (this.#closed) return Promise.reject(new Error("ACP transport is closed"));
    const id = this.#nextId++;
    return new Promise<R>((resolve, reject) => {
      this.#pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.#write({ jsonrpc: "2.0", id, method, params });
    });
  }

  /** Terminate the agent process. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#child.stdin.end();
      this.#child.kill();
    } catch {
      /* already gone */
    }
  }
}
