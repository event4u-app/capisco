/**
 * Claude-Code stream-json parser (B8 Phase 2a) — PURE, no process spawn, no DOM.
 *
 * The installed `claude` CLI (Claude Code 2.x) does NOT speak ACP; it speaks the
 * SDK stream-json mode (`claude -p --output-format=stream-json
 * --input-format=stream-json --verbose`). Each stdout line is one JSON envelope.
 * This module translates those envelopes into our {@link SessionEvent} contract
 * (the same union the mock/stub/ACP paths emit) and extracts the {@link AcpToolCall}s
 * the driver must route through the broker.
 *
 * The split mirrors `git-parse.ts` (B1) / `quality-parse.ts` (B5): the parser is
 * a deterministic function over already-decoded JSON objects, unit-tested on a
 * recorded fixture string — the child-process spawn lives in the transport
 * primitive (`claude-stream-exec.ts`), the broker seam + run loop in
 * `claude-code-provider.ts`. No real `claude` is invoked anywhere in the tests.
 *
 * Claude Code stream-json envelope shapes (the subset we map):
 *  - `{type:"system", subtype:"init", session_id, model, tools:[...]}` — run start.
 *  - `{type:"assistant", message:{role, content:[ {type:"text", text}
 *      | {type:"tool_use", id, name, input} ]}, session_id}` — assistant turn.
 *  - `{type:"user", message:{role, content:[ {type:"tool_result", tool_use_id,
 *      content, is_error} ]}, session_id}` — a tool result echoed back.
 *  - `{type:"result", subtype:"success"|"error_*", result, is_error, usage:{
 *      input_tokens, output_tokens}, duration_ms, session_id}` — terminal.
 *
 * Untrusted by default: the parser only DESCRIBES what the CLI emitted — it never
 * decides trust. The driver (`claude-code-provider.ts`) assigns egress taint by
 * session provenance (client-assigned taint, Red-team Fix 1) and routes every
 * extracted tool call through the broker. The parser maps a Claude tool name to a
 * broker {@link CapabilityKind} conservatively (unknown → `shell`, the
 * narrowest-allowlisted, always-`ask` kind) so a novel tool can never be
 * mis-classified into a more permissive lane.
 */

import type { AcpToolCall, CapabilityKind, SessionEvent, Telemetry } from "@/contracts";

/** A decoded Claude-Code stream-json line (already `JSON.parse`d). */
export type StreamJsonEnvelope = Record<string, unknown>;

/**
 * The parser's output for ONE envelope: the {@link SessionEvent}s to emit (in
 * order) and any tool call the driver must gate through the broker. A `tool_use`
 * produces a `toolCall` (no `tool` SessionEvent yet — that is emitted by the
 * driver only AFTER the broker authorizes it, so a denied call never appears as
 * an executed tool in the transcript). `done` is true on the terminal `result`.
 */
export interface ParsedEnvelope {
  events: SessionEvent[];
  /** A tool call to route through the broker (from an assistant `tool_use`). */
  toolCalls: AcpToolCall[];
  /** True when this envelope is the terminal `result`. */
  done: boolean;
  /** The model label from a `system/init` envelope, when present. */
  model?: string;
  /** The CLI's own session id from `system/init`, when present (diagnostics). */
  cliSessionId?: string;
}

/**
 * Map a Claude-Code tool name to a broker {@link CapabilityKind}. Conservative:
 * an unrecognised tool maps to `shell` (the narrowest, always-`ask` lane) so a
 * new/unknown tool can NEVER be silently routed into a more permissive kind. The
 * recognised names follow Claude Code's built-in tool set.
 */
export function toolKind(name: string): CapabilityKind {
  switch (name) {
    case "Read":
    case "Glob":
    case "Grep":
    case "NotebookRead":
      return "file-read";
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return "file-write";
    case "WebFetch":
    case "WebSearch":
      return "network";
    case "Bash":
    case "BashOutput":
    case "KillBash":
      return "shell";
    default:
      // Unknown / MCP / custom tool → shell (always-ask). Never default to a
      // more permissive kind — an unrecognised capability is treated as the
      // most-gated one.
      return "shell";
  }
}

/**
 * Derive the broker `target` for a tool call from its input. The broker matches
 * the allowlist against this string, so it must be the concrete object the tool
 * acts on (a path, a command line, a url) — never a secret. We read the common
 * Claude Code input fields; anything unrecognised falls back to the JSON of the
 * input (still non-secret — Claude tool inputs carry no credential values).
 */
export function toolTarget(name: string, input: Record<string, unknown>): string {
  const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
  switch (name) {
    case "Bash":
      return str(input.command) ?? "";
    case "Read":
    case "Write":
    case "Edit":
    case "MultiEdit":
    case "NotebookRead":
    case "NotebookEdit":
      return str(input.file_path) ?? str(input.path) ?? str(input.notebook_path) ?? "";
    case "Glob":
    case "Grep":
      return str(input.pattern) ?? str(input.path) ?? "";
    case "WebFetch":
    case "WebSearch":
      return str(input.url) ?? str(input.query) ?? "";
    default:
      // A non-secret structural description of the call for the audit/allowlist.
      try {
        return JSON.stringify(input);
      } catch {
        return name;
      }
  }
}

function asObject(v: unknown): Record<string, unknown> | undefined {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Parse ONE Claude-Code stream-json envelope into our SessionEvent contract +
 * any tool calls to gate. Total over the union; an unrecognised `type` produces
 * no events (silently ignored, like a keep-alive) — never throws.
 */
export function parseStreamJsonEnvelope(env: StreamJsonEnvelope): ParsedEnvelope {
  const out: ParsedEnvelope = { events: [], toolCalls: [], done: false };
  const type = env.type;

  if (type === "system" && env.subtype === "init") {
    const model = typeof env.model === "string" ? env.model : undefined;
    const cliSessionId = typeof env.session_id === "string" ? env.session_id : undefined;
    out.model = model;
    out.cliSessionId = cliSessionId;
    out.events.push({ type: "status", status: "running" });
    return out;
  }

  if (type === "assistant") {
    const message = asObject(env.message);
    const content = asArray(message?.content);
    const messageId =
      (message && typeof message.id === "string" && message.id) ||
      (typeof env.session_id === "string" ? `${env.session_id}-a` : "assistant");
    for (const blockRaw of content) {
      const block = asObject(blockRaw);
      if (!block) continue;
      if (block.type === "text" && typeof block.text === "string") {
        // The assistant's text is streamed as a token delta (the whole block
        // text — Claude Code emits a full assistant message per envelope, not a
        // per-character delta, in non-partial stream-json mode).
        if (block.text.length > 0) {
          out.events.push({ type: "token", messageId, delta: block.text });
        }
      } else if (block.type === "tool_use") {
        const name = typeof block.name === "string" ? block.name : "Tool";
        const id = typeof block.id === "string" ? block.id : `${messageId}-tool`;
        const input = asObject(block.input) ?? {};
        out.toolCalls.push({
          callId: id,
          kind: toolKind(name),
          target: toolTarget(name, input),
          title: name,
        });
      }
    }
    return out;
  }

  if (type === "result") {
    // Terminal envelope. Emit telemetry (when present), then done.
    const usage = asObject(env.usage);
    if (usage) {
      const tokensIn = typeof usage.input_tokens === "number" ? usage.input_tokens : 0;
      const tokensOut = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;
      const runtimeMs = typeof env.duration_ms === "number" ? env.duration_ms : 0;
      const telemetry: Telemetry = { tokensIn, tokensOut, runtimeMs };
      out.events.push({ type: "telemetry", telemetry });
    }
    const isError = env.is_error === true || (typeof env.subtype === "string" && env.subtype !== "success");
    if (isError) out.events.push({ type: "status", status: "error" });
    out.done = true;
    return out;
  }

  // `user` (tool_result echo) and any other envelope type carry no SessionEvent
  // here — the tool block is recorded by the driver when the broker authorizes
  // it, not from the CLI's own echo (which would double-count / bypass the gate).
  return out;
}
