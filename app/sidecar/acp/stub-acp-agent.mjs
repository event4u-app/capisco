#!/usr/bin/env node
/**
 * stub-acp-agent.mjs (B3 Phase 1) — a DETERMINISTIC ACP agent over JSON-RPC/
 * NDJSON stdio. It stands in for a real ACP agent CLI (Claude Code, Codex,
 * Gemini …) so the transport + broker seam are testable WITHOUT an LLM key or a
 * real agent (those are DEFERRED — a thin swap behind the same stdio protocol).
 *
 * Wire (one JSON value per `\n` line on stdin/stdout):
 *   client → agent  (requests):
 *     session/new     {cwd, model}            → result {sessionId}
 *     session/prompt  {sessionId, prompt}     → result {done:true}
 *   agent → client  (requests — the BROKER SEAM):
 *     session/request_permission {call, fromUntrusted}
 *                                              ← result {outcome, reason}
 *   agent → client  (notifications, id-less):
 *     session/update  {sessionId, event}      (SessionEvent payloads)
 *
 * HARD SECURITY PROPERTY (verified by tests): the stub has NO direct fs / shell
 * / net capability. The ONLY way it can "act" is by emitting
 * `session/request_permission` and WAITING for the client's answer. It cannot
 * read a file, run a command, or open a socket on its own — so it cannot act
 * around the broker the client puts behind that request. On a `deny`, the
 * scripted action is skipped and reported as blocked in the transcript.
 *
 * DETERMINISM: the script is fixed (no Math.random / Date.now). The same prompt
 * always produces the same sequence of updates + permission requests, so the
 * integration tests are reproducible.
 *
 * Pure Node — no TS, no imports of the app. Spawned via `node stub-acp-agent.mjs`.
 */

import process from "node:process";

let buffer = "";
let nextReqId = 1;
/** id → {resolve} for in-flight agent→client requests (permission asks). */
const pending = new Map();

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function notify(sessionId, event) {
  send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, event } });
}

/** Ask the client for permission and await its allow/deny answer. */
function requestPermission(call, fromUntrusted) {
  const id = nextReqId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    send({
      jsonrpc: "2.0",
      id,
      method: "session/request_permission",
      params: { call, fromUntrusted },
    });
  });
}

/**
 * The deterministic run script. For each step the stub WANTS to act, it must
 * first ask the client (broker) — and only proceeds on `allow`. There is no
 * code path that touches fs/shell/net directly.
 */
async function runPrompt(sessionId, prompt) {
  notify(sessionId, { type: "status", status: "running" });

  // 1. An agent acknowledgement message, streamed in two token deltas.
  const messageId = `${sessionId}-a1`;
  const reply = `Working on: ${prompt}`;
  const half = Math.ceil(reply.length / 2);
  notify(sessionId, { type: "token", messageId, delta: reply.slice(0, half) });
  notify(sessionId, { type: "token", messageId, delta: reply.slice(half) });

  // 2. A read of the worktree — must pass the broker (file-read).
  const readCall = {
    callId: `${sessionId}-c1`,
    kind: "file-read",
    target: "README.md",
    title: "Read",
  };
  const readAnswer = await requestPermission(readCall, false);
  if (readAnswer.outcome === "allow") {
    notify(sessionId, {
      type: "tool",
      block: { id: readCall.callId, kind: "Read", target: readCall.target },
    });
  } else {
    notify(sessionId, {
      type: "tool",
      block: { id: readCall.callId, kind: "Read (blocked)", target: readCall.target },
    });
  }

  // 3. A WRITE derived from the (untrusted) prompt — lethal-trifecta egress, so
  //    the stub marks it fromUntrusted. The client/broker HARD-gates it; the
  //    stub cannot bypass that gate.
  const writeCall = {
    callId: `${sessionId}-c2`,
    kind: "file-write",
    target: "TODO-done.md",
    title: "Edit",
  };
  const writeAnswer = await requestPermission(writeCall, true);
  if (writeAnswer.outcome === "allow") {
    notify(sessionId, {
      type: "tool",
      block: { id: writeCall.callId, kind: "Edit", target: writeCall.target, added: 1, removed: 0 },
    });
  } else {
    notify(sessionId, {
      type: "tool",
      block: { id: writeCall.callId, kind: "Edit (blocked)", target: writeCall.target },
    });
  }

  // 4. Final telemetry + done. Deterministic counts (no randomness).
  notify(sessionId, { type: "telemetry", telemetry: { tokensIn: 42, tokensOut: 128, runtimeMs: 1000 } });
  notify(sessionId, { type: "status", status: "done" });
  notify(sessionId, { type: "done" });
}

async function handleRequest(msg) {
  const { id, method, params } = msg;
  try {
    if (method === "session/new") {
      // Deterministic session id derived from cwd hash-free (counter-based).
      const sessionId = params?.sessionId ?? `acp-${id}`;
      send({ jsonrpc: "2.0", id, result: { sessionId } });
      return;
    }
    if (method === "session/prompt") {
      // Acknowledge the prompt request immediately; stream updates, then resolve.
      await runPrompt(params.sessionId, params.prompt);
      send({ jsonrpc: "2.0", id, result: { done: true } });
      return;
    }
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `unknown method ${method}` } });
  } catch (err) {
    send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(err) } });
  }
}

function handleMessage(msg) {
  // A response to one of OUR permission requests (agent → client → agent).
  if (msg.id !== undefined && msg.method === undefined) {
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      // Default-deny on a malformed/empty answer — fail closed.
      resolve(msg.result ?? { outcome: "deny", reason: "no result" });
    }
    return;
  }
  // A request FROM the client.
  if (msg.method !== undefined && msg.id !== undefined) {
    void handleRequest(msg);
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl = buffer.indexOf("\n");
  while (nl !== -1) {
    const line = buffer.slice(0, nl);
    buffer = buffer.slice(nl + 1);
    if (line.trim().length > 0) {
      try {
        handleMessage(JSON.parse(line));
      } catch {
        /* skip malformed line */
      }
    }
    nl = buffer.indexOf("\n");
  }
});

process.stdin.on("end", () => process.exit(0));
