/**
 * LSP host (road-to-actually-works P5).
 *
 * Spawns a language server THROUGH the P1 process-supervisor (the shared
 * spawn/reap primitive — LSP is its first real long-lived consumer), speaks LSP
 * JSON-RPC over its stdio, and exposes the editor-facing reads: completion,
 * hover, and live diagnostics. This is the sidecar half; the CM6 autocomplete
 * wiring consumes it over the IPC `lsp` provider.
 *
 * Lifecycle note (road-to-real-runtime P3/P4): the server is spawned with an
 * `on-crash` restart policy THROUGH the P1 supervisor (exponential backoff,
 * capped). When the server dies, the supervisor respawns it and the host
 * transparently re-synchronises state — re-`initialize`, then replay every
 * tracked `didOpen` — so editor reads keep working without the consumer
 * recreating anything. In-flight requests fail fast (no 15s hang) and an
 * optional `onRestart` callback lets the UI surface "language server restarted".
 */

import { pathToFileURL } from "node:url";

import {
  ProcessSupervisor,
  type ProcessState,
  type RestartPolicy,
  type SupervisedProcess,
} from "../supervisor/process-supervisor.ts";
import { LspDecoder, encode, type JsonRpcMessage } from "./lsp-jsonrpc.ts";
import {
  normalizeInlayHints,
  normalizeLocations,
  normalizeSymbols,
  normalizeWorkspaceEdit,
} from "./lsp-normalize.ts";
import type { LspInlayHint, LspLocation, LspSymbol, LspWorkspaceEdit } from "@/contracts";

export interface LspServerSpec {
  /** Stable id, e.g. `lsp:ts:/repo`. */
  id: string;
  command: string;
  args?: string[];
  /** Worktree root the server is initialised against. */
  rootPath: string;
  /** Server-specific initialize options (e.g. tsserver inlay-hint preferences). */
  initializationOptions?: Record<string, unknown>;
}

export interface LspCompletionItem {
  label: string;
  detail?: string;
  kind?: number;
}

export interface LspHostOptions {
  /** Inject a supervisor (tests) — defaults to a fresh one. */
  supervisor?: ProcessSupervisor;
  /** Fired after the server crashed and was respawned + re-synced (UI: "restarted"). */
  onRestart?: (info: { restarts: number }) => void;
}

const RESPONSE_TIMEOUT_MS = 15_000;

/** Crash-restart with backoff (road-to-real-runtime P4): a dead server is
 *  respawned through the P1 supervisor, doubling 200ms→5s, up to 5 times. */
const LSP_RESTART: RestartPolicy = {
  mode: "on-crash",
  maxRestarts: 5,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
};

export function fileUri(path: string): string {
  return pathToFileURL(path).href;
}

export class LspHost {
  readonly #proc: SupervisedProcess;
  readonly #decoder = new LspDecoder();
  readonly #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  readonly #diagnostics = new Map<string, unknown[]>();
  /** Docs opened on this host, replayed verbatim after a crash-restart (resync). */
  readonly #openDocs = new Map<string, { languageId: string; version: number; text: string }>();
  #seq = 0;
  #disposed = false;
  #serverDown = false;
  #ready: Promise<void>;
  #resolveReady: (() => void) | undefined;
  readonly #rootPath: string;
  readonly #initOptions?: Record<string, unknown>;
  readonly #onRestart?: (info: { restarts: number }) => void;

  constructor(spec: LspServerSpec, opts: LspHostOptions = {}) {
    this.#rootPath = spec.rootPath;
    this.#initOptions = spec.initializationOptions;
    this.#onRestart = opts.onRestart;
    const supervisor = opts.supervisor ?? new ProcessSupervisor();
    this.#proc = supervisor.spawn(
      { id: spec.id, command: spec.command, args: spec.args ?? ["--stdio"], cwd: spec.rootPath, restart: LSP_RESTART },
      {
        onStdout: (chunk) => {
          for (const msg of this.#decoder.push(chunk)) this.#onMessage(msg);
        },
        onState: (state, info) => this.#onState(state, info.restarts),
      },
    );
    this.#ready = this.#bringUp();
  }

  /** React to supervisor lifecycle transitions: tear down on crash, re-sync on
   *  respawn. The initial `running` (restarts 0) is a no-op — the constructor
   *  drives the first bring-up directly. */
  #onState(state: ProcessState, restarts: number): void {
    if (this.#disposed) return;
    if (state === "restarting") {
      // The connection is dead: block new reads behind a fresh gate, drop the
      // stale frame, and fail every in-flight request now (no 15s timeout hang).
      this.#serverDown = true;
      this.#decoder.reset();
      this.#rejectPending(new Error("LSP server restarted"));
      this.#diagnostics.clear();
      this.#ready = new Promise<void>((resolve) => {
        this.#resolveReady = resolve;
      });
    } else if (state === "running" && this.#serverDown) {
      // Respawned: re-initialise + replay open docs, then unblock + signal.
      // Defer one microtask — the supervisor fires `running` BEFORE it wires the
      // new child's stdout, so sending `initialize` synchronously here would land
      // before anyone is listening for the reply.
      this.#serverDown = false;
      queueMicrotask(() => {
        if (this.#disposed) return;
        void this.#bringUp().then(() => this.#onRestart?.({ restarts }));
      });
    } else if (state === "exited") {
      // Supervisor gave up (maxRestarts) — fail callers instead of hanging.
      this.#rejectPending(new Error("LSP server exited"));
    }
  }

  #send(msg: JsonRpcMessage): void {
    this.#proc.write(encode(msg));
  }

  request<T = unknown>(method: string, params: unknown): Promise<T> {
    const id = ++this.#seq;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`LSP request timed out: ${method}`));
      }, RESPONSE_TIMEOUT_MS);
      this.#pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.#send({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params: unknown): void {
    this.#send({ jsonrpc: "2.0", method, params });
  }

  #rejectPending(err: Error): void {
    for (const p of this.#pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.#pending.clear();
  }

  #onMessage(msg: JsonRpcMessage): void {
    if (typeof msg.id === "number" && this.#pending.has(msg.id)) {
      const p = this.#pending.get(msg.id)!;
      this.#pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === "textDocument/publishDiagnostics") {
      const params = msg.params as { uri?: string; diagnostics?: unknown[] } | undefined;
      if (params?.uri) this.#diagnostics.set(params.uri, params.diagnostics ?? []);
    }
    // Server→client requests (e.g. workspace/configuration) — reply minimally so
    // the server does not block waiting on us.
    if (typeof msg.id === "number" && msg.method) {
      this.#send({ jsonrpc: "2.0", id: msg.id, result: null });
    }
  }

  /** Initialise the (re)spawned server and replay every open doc, then resolve
   *  the current readiness gate. Used for the first start AND each crash-restart. */
  async #bringUp(): Promise<void> {
    await this.#sendInitialize();
    for (const [uri, doc] of this.#openDocs) {
      this.notify("textDocument/didOpen", {
        textDocument: { uri, languageId: doc.languageId, version: doc.version, text: doc.text },
      });
    }
    this.#resolveReady?.();
  }

  async #sendInitialize(): Promise<void> {
    await this.request("initialize", {
      processId: process.pid,
      rootUri: fileUri(this.#rootPath),
      initializationOptions: this.#initOptions,
      capabilities: {
        textDocument: {
          synchronization: { didSave: true, dynamicRegistration: false },
          completion: { completionItem: { snippetSupport: false } },
          hover: { contentFormat: ["plaintext", "markdown"] },
          publishDiagnostics: {},
          definition: { dynamicRegistration: false, linkSupport: true },
          references: { dynamicRegistration: false },
          rename: { dynamicRegistration: false },
          documentSymbol: { dynamicRegistration: false, hierarchicalDocumentSymbolSupport: true },
          inlayHint: { dynamicRegistration: false },
        },
      },
    });
    this.notify("initialized", {});
  }

  /** Underlying server PID (undefined while restarting / after dispose). */
  get pid(): number | undefined {
    return this.#proc.pid;
  }

  ready(): Promise<void> {
    return this.#ready;
  }

  async openDoc(uri: string, languageId: string, text: string): Promise<void> {
    // Track first so a crash mid-await still replays this doc on respawn.
    this.#openDocs.set(uri, { languageId, version: 1, text });
    await this.#ready;
    this.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version: 1, text },
    });
  }

  async completion(uri: string, line: number, character: number): Promise<LspCompletionItem[]> {
    await this.#ready;
    const r = await this.request<unknown>("textDocument/completion", {
      textDocument: { uri },
      position: { line, character },
    });
    const items = Array.isArray(r) ? r : ((r as { items?: unknown[] })?.items ?? []);
    return (items as Array<{ label: string; detail?: string; kind?: number }>).map((i) => ({
      label: i.label,
      detail: i.detail,
      kind: i.kind,
    }));
  }

  async hover(uri: string, line: number, character: number): Promise<string | null> {
    await this.#ready;
    const r = await this.request<{ contents?: unknown }>("textDocument/hover", {
      textDocument: { uri },
      position: { line, character },
    });
    if (!r?.contents) return null;
    const c = r.contents;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return c.map((x) => (typeof x === "string" ? x : (x as { value?: string }).value ?? "")).join("\n");
    return (c as { value?: string }).value ?? null;
  }

  async definition(uri: string, line: number, character: number): Promise<LspLocation[]> {
    await this.#ready;
    return normalizeLocations(
      await this.request("textDocument/definition", {
        textDocument: { uri },
        position: { line, character },
      }),
    );
  }

  async references(uri: string, line: number, character: number): Promise<LspLocation[]> {
    await this.#ready;
    return normalizeLocations(
      await this.request("textDocument/references", {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration: true },
      }),
    );
  }

  async rename(
    uri: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<LspWorkspaceEdit> {
    await this.#ready;
    return normalizeWorkspaceEdit(
      await this.request("textDocument/rename", {
        textDocument: { uri },
        position: { line, character },
        newName,
      }),
    );
  }

  async documentSymbol(uri: string): Promise<LspSymbol[]> {
    await this.#ready;
    return normalizeSymbols(await this.request("textDocument/documentSymbol", { textDocument: { uri } }));
  }

  async inlayHints(uri: string, startLine: number, endLine: number): Promise<LspInlayHint[]> {
    await this.#ready;
    return normalizeInlayHints(
      await this.request("textDocument/inlayHint", {
        textDocument: { uri },
        range: {
          start: { line: startLine, character: 0 },
          end: { line: endLine, character: 0 },
        },
      }),
    );
  }

  diagnostics(uri: string): unknown[] {
    return this.#diagnostics.get(uri) ?? [];
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#rejectPending(new Error("LSP host disposed"));
    this.#openDocs.clear();
    try {
      this.notify("shutdown", null);
    } catch {
      /* server may be gone */
    }
    this.#proc.kill();
  }
}
