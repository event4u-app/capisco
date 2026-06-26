/**
 * LSP host (road-to-actually-works P5).
 *
 * Spawns a language server THROUGH the P1 process-supervisor (the shared
 * spawn/reap primitive — LSP is its first real long-lived consumer), speaks LSP
 * JSON-RPC over its stdio, and exposes the editor-facing reads: completion,
 * hover, and live diagnostics. This is the sidecar half; the CM6 autocomplete
 * wiring consumes it over the IPC `lsp` provider.
 *
 * Lifecycle note: this version spawns with restart "never" — a crashed server
 * disposes the host and the consumer recreates it (re-initialize + re-didOpen).
 * Per-worktree multi-server lifecycle + crash-resync is refined in
 * road-to-real-runtime P3 (Advanced-LSP), which builds on this host.
 */

import { pathToFileURL } from "node:url";

import { ProcessSupervisor, type SupervisedProcess } from "../supervisor/process-supervisor.ts";
import { LspDecoder, encode, type JsonRpcMessage } from "./lsp-jsonrpc.ts";
import { normalizeLocations, normalizeSymbols, normalizeWorkspaceEdit } from "./lsp-normalize.ts";
import type { LspLocation, LspSymbol, LspWorkspaceEdit } from "@/contracts";

export interface LspServerSpec {
  /** Stable id, e.g. `lsp:ts:/repo`. */
  id: string;
  command: string;
  args?: string[];
  /** Worktree root the server is initialised against. */
  rootPath: string;
}

export interface LspCompletionItem {
  label: string;
  detail?: string;
  kind?: number;
}

export interface LspHostOptions {
  /** Inject a supervisor (tests) — defaults to a fresh one. */
  supervisor?: ProcessSupervisor;
}

const RESPONSE_TIMEOUT_MS = 15_000;

export function fileUri(path: string): string {
  return pathToFileURL(path).href;
}

export class LspHost {
  readonly #proc: SupervisedProcess;
  readonly #decoder = new LspDecoder();
  readonly #pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  readonly #diagnostics = new Map<string, unknown[]>();
  #seq = 0;
  #disposed = false;
  readonly #ready: Promise<void>;

  constructor(spec: LspServerSpec, opts: LspHostOptions = {}) {
    const supervisor = opts.supervisor ?? new ProcessSupervisor();
    this.#proc = supervisor.spawn(
      { id: spec.id, command: spec.command, args: spec.args ?? ["--stdio"], cwd: spec.rootPath, restart: "never" },
      {
        onStdout: (chunk) => {
          for (const msg of this.#decoder.push(chunk)) this.#onMessage(msg);
        },
      },
    );
    this.#ready = this.#initialize(spec.rootPath);
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

  async #initialize(rootPath: string): Promise<void> {
    await this.request("initialize", {
      processId: process.pid,
      rootUri: fileUri(rootPath),
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
        },
      },
    });
    this.notify("initialized", {});
  }

  ready(): Promise<void> {
    return this.#ready;
  }

  async openDoc(uri: string, languageId: string, text: string): Promise<void> {
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

  diagnostics(uri: string): unknown[] {
    return this.#diagnostics.get(uri) ?? [];
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const p of this.#pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("LSP host disposed"));
    }
    this.#pending.clear();
    try {
      this.notify("shutdown", null);
    } catch {
      /* server may be gone */
    }
    this.#proc.kill();
  }
}
