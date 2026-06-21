#!/usr/bin/env node
/**
 * double-egress-stub-acp-agent.mjs (live-permission-gate test fixture) — a
 * deterministic ACP agent that issues TWO untrusted file-writes to the SAME
 * target, one after the other. Used by the live human-in-the-loop gate
 * integration test to prove:
 *
 *  - the first untrusted egress parks an `ask` that the UI clears with `once`,
 *    unblocking EXACTLY that one execution; and
 *  - the second, same-shape untrusted egress RE-ASKS (the single-use grant was
 *    consumed and is target-bound — it can never pre-clear a later egress).
 *
 * Like the other stubs it has NO direct fs/shell/net capability — it can only
 * `session/request_permission` and WAIT for the client's broker-mediated answer.
 * Pure Node, no app imports. Spawned via `node double-egress-stub-acp-agent.mjs`.
 */

import process from "node:process";

let buffer = "";
let nextReqId = 1;
const pending = new Map();

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function notify(sessionId, event) {
  send({ jsonrpc: "2.0", method: "session/update", params: { sessionId, event } });
}

function requestPermission(call, fromUntrusted) {
  const id = nextReqId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    send({ jsonrpc: "2.0", id, method: "session/request_permission", params: { call, fromUntrusted } });
  });
}

async function runPrompt(sessionId, prompt) {
  notify(sessionId, { type: "status", status: "running" });
  const messageId = `${sessionId}-a1`;
  notify(sessionId, { type: "token", messageId, delta: `Working on: ${prompt}` });

  // Two untrusted writes to the SAME target. Each must be gated independently.
  for (const n of [1, 2]) {
    const call = {
      callId: `${sessionId}-w${n}`,
      kind: "file-write",
      target: "TODO-done.md",
      title: "Edit",
    };
    const answer = await requestPermission(call, true);
    if (answer.outcome === "allow") {
      notify(sessionId, {
        type: "tool",
        block: { id: call.callId, kind: "Edit", target: call.target, added: 1, removed: 0 },
      });
    } else {
      notify(sessionId, {
        type: "tool",
        block: { id: call.callId, kind: "Edit (blocked)", target: call.target },
      });
    }
  }

  notify(sessionId, { type: "telemetry", telemetry: { tokensIn: 1, tokensOut: 2, runtimeMs: 1 } });
  notify(sessionId, { type: "status", status: "done" });
  notify(sessionId, { type: "done" });
}

async function handleRequest(msg) {
  const { id, method, params } = msg;
  try {
    if (method === "session/new") {
      send({ jsonrpc: "2.0", id, result: { sessionId: params?.sessionId ?? `acp-${id}` } });
      return;
    }
    if (method === "session/prompt") {
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
  if (msg.id !== undefined && msg.method === undefined) {
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
      resolve(msg.result ?? { outcome: "deny", reason: "no result" });
    }
    return;
  }
  if (msg.method !== undefined && msg.id !== undefined) void handleRequest(msg);
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
