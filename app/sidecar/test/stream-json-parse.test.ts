// @vitest-environment node
/**
 * Pure stream-json parser tests (B8 Phase 2a). Like `git-parse.test.ts` /
 * `quality-parse.test.ts`, these run the parser on recorded envelope strings —
 * no process spawn, no real `claude`, fully deterministic. They pin the
 * Claude-Code stream-json → {@link SessionEvent} mapping and the conservative
 * tool-name → broker-kind classification.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseStreamJsonEnvelope,
  toolKind,
  toolTarget,
  type StreamJsonEnvelope,
} from "../acp/stream-json-parse.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, "..", "acp", "fixtures", "claude-stream-json.fixture.jsonl");

function loadFixtureEnvelopes(): StreamJsonEnvelope[] {
  return readFileSync(FIXTURE, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as StreamJsonEnvelope);
}

describe("stream-json parser — envelope mapping", () => {
  it("maps system/init to a running status + carries the model", () => {
    const parsed = parseStreamJsonEnvelope({
      type: "system",
      subtype: "init",
      session_id: "cli-1",
      model: "claude-opus-4-8",
      tools: ["Read"],
    });
    expect(parsed.events).toEqual([{ type: "status", status: "running" }]);
    expect(parsed.model).toBe("claude-opus-4-8");
    expect(parsed.cliSessionId).toBe("cli-1");
    expect(parsed.toolCalls).toEqual([]);
    expect(parsed.done).toBe(false);
  });

  it("maps an assistant text block to a token delta", () => {
    const parsed = parseStreamJsonEnvelope({
      type: "assistant",
      session_id: "cli-1",
      message: { id: "msg1", role: "assistant", content: [{ type: "text", text: "Hello" }] },
    });
    expect(parsed.events).toEqual([{ type: "token", messageId: "msg1", delta: "Hello" }]);
    expect(parsed.toolCalls).toEqual([]);
  });

  it("extracts a tool_use as a broker-routable AcpToolCall (no tool event yet)", () => {
    const parsed = parseStreamJsonEnvelope({
      type: "assistant",
      session_id: "cli-1",
      message: {
        id: "msg2",
        role: "assistant",
        content: [{ type: "tool_use", id: "toolu_1", name: "Edit", input: { file_path: "a.ts" } }],
      },
    });
    // The tool is NOT emitted as a SessionEvent here — it is gated by the driver
    // and only recorded after the broker authorizes it.
    expect(parsed.events).toEqual([]);
    expect(parsed.toolCalls).toEqual([
      { callId: "toolu_1", kind: "file-write", target: "a.ts", title: "Edit" },
    ]);
  });

  it("maps result to telemetry + done", () => {
    const parsed = parseStreamJsonEnvelope({
      type: "result",
      subtype: "success",
      is_error: false,
      duration_ms: 1234,
      session_id: "cli-1",
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    expect(parsed.events).toEqual([
      { type: "telemetry", telemetry: { tokensIn: 10, tokensOut: 20, runtimeMs: 1234 } },
    ]);
    expect(parsed.done).toBe(true);
  });

  it("marks an error result with a status:error before done", () => {
    const parsed = parseStreamJsonEnvelope({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      duration_ms: 5,
      usage: { input_tokens: 1, output_tokens: 0 },
    });
    expect(parsed.events.some((e) => e.type === "status" && e.status === "error")).toBe(true);
    expect(parsed.done).toBe(true);
  });

  it("emits no events for a user (tool_result echo) or unknown envelope", () => {
    expect(parseStreamJsonEnvelope({ type: "user", message: { role: "user", content: [] } })).toEqual({
      events: [],
      toolCalls: [],
      done: false,
    });
    expect(parseStreamJsonEnvelope({ type: "keep-alive" })).toEqual({
      events: [],
      toolCalls: [],
      done: false,
    });
  });
});

describe("stream-json parser — conservative tool classification", () => {
  it("maps known read tools to file-read", () => {
    for (const name of ["Read", "Glob", "Grep", "NotebookRead"]) {
      expect(toolKind(name)).toBe("file-read");
    }
  });

  it("maps known write tools to file-write", () => {
    for (const name of ["Write", "Edit", "MultiEdit", "NotebookEdit"]) {
      expect(toolKind(name)).toBe("file-write");
    }
  });

  it("maps web tools to network and bash to shell", () => {
    expect(toolKind("WebFetch")).toBe("network");
    expect(toolKind("WebSearch")).toBe("network");
    expect(toolKind("Bash")).toBe("shell");
  });

  it("maps an unknown/MCP/custom tool to shell (most-gated lane, never permissive)", () => {
    expect(toolKind("mcp__some__tool")).toBe("shell");
    expect(toolKind("TotallyNovelTool")).toBe("shell");
  });

  it("derives a non-secret target from the tool input", () => {
    expect(toolTarget("Bash", { command: "ls -la" })).toBe("ls -la");
    expect(toolTarget("Read", { file_path: "src/x.ts" })).toBe("src/x.ts");
    expect(toolTarget("WebFetch", { url: "https://example.com" })).toBe("https://example.com");
    expect(toolTarget("Grep", { pattern: "TODO" })).toBe("TODO");
  });
});

describe("stream-json parser — over the committed fixture", () => {
  it("yields the deterministic event sequence + the two gated tool calls", () => {
    const envelopes = loadFixtureEnvelopes();
    const events: string[] = [];
    const toolCalls: string[] = [];
    let doneCount = 0;
    for (const env of envelopes) {
      const parsed = parseStreamJsonEnvelope(env);
      for (const e of parsed.events) events.push(e.type);
      for (const c of parsed.toolCalls) toolCalls.push(`${c.kind}:${c.target}`);
      if (parsed.done) doneCount += 1;
    }
    // status(running) … tokens … telemetry, exactly one terminal result.
    expect(events[0]).toBe("status");
    expect(events.filter((t) => t === "token").length).toBe(3);
    expect(events.filter((t) => t === "telemetry").length).toBe(1);
    expect(doneCount).toBe(1);
    // The two tool_use blocks: a Read (file-read) then an Edit (file-write).
    expect(toolCalls).toEqual(["file-read:README.md", "file-write:TODO-done.md"]);
  });
});
