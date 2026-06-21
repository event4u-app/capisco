#!/usr/bin/env node
/**
 * fake-acp-bridge.mjs (B8 P2b) — a DETERMINISTIC, standard-ACP-speaking process
 * that stands in for the real `@zed-industries/claude-code-acp` bridge so the
 * IDE side of the ACP handshake is testable WITHOUT fetching or running the real
 * bridge (that is the user's broker-approved go, and would drive a real/paid
 * Claude call). It verifies OUR side of the protocol is correct.
 *
 * The ONE thing that distinguishes it from the in-repo `stub-acp-agent.mjs`: it
 * speaks the standard ACP `initialize` handshake and REQUIRES it before
 * `session/new`. A `session/new` that arrives before a successful `initialize`
 * is rejected — exactly as the real bridge behaves. This is the property the
 * P2b test pins: our `AcpSession` negotiates the protocol version up front.
 *
 * Wire (one JSON value per `\n` line on stdin/stdout):
 *   client → agent  (requests):
 *     initialize      {protocolVersion, clientCapabilities}
 *                                              → result {protocolVersion, agentCapabilities}
 *     session/new     {cwd, model, sessionId}  → result {sessionId}
 *     session/prompt  {sessionId, prompt}      → result {done:true}
 *   agent → client  (requests — the BROKER SEAM):
 *     session/request_permission {call, fromUntrusted}
 *                                              ← result {outcome, reason}
 *   agent → client  (notifications, id-less):
 *     session/update  {sessionId, event}       (SessionEvent payloads)
 *
 * HARD SECURITY PROPERTY (same as the stub, verified by tests): no direct fs /
 * shell / net capability. The ONLY way it can "act" is by emitting
 * `session/request_permission` and waiting for the client's answer — it cannot
 * act around the broker the client puts behind that request.
 *
 * DETERMINISM: fixed script, no Math.random / Date.now. Pure Node — no TS, no
 * app imports. Spawned via `node fake-acp-bridge.mjs`.
 */

import process from "node:process";

/** The ACP protocol version this fake bridge speaks (mirrors ACP_PROTOCOL_VERSION). */
const PROTOCOL_VERSION = 1;

let buffer = "";
let nextReqId = 1;
let initialized = false;
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
 * The deterministic run script — identical shape to the in-repo stub so the
 * broker seam exercises the same gate (file-read allowed, untrusted file-write
 * hard-gated). The bridge cannot touch fs/shell/net directly.
 */
async function runPrompt(sessionId, prompt) {
  notify(sessionId, { type: "status", status: "running" });

  const messageId = `${sessionId}-a1`;
  const reply = `Working on: ${prompt}`;
  const half = Math.ceil(reply.length / 2);
  notify(sessionId, { type: "token", messageId, delta: reply.slice(0, half) });
  notify(sessionId, { type: "token", messageId, delta: reply.slice(half) });

  const readCall = {
    callId: `${sessionId}-c1`,
    kind: "file-read",
    target: "README.md",
    title: "Read",
  };
  const readAnswer = await requestPermission(readCall, false);
  notify(sessionId, {
    type: "tool",
    block: {
      id: readCall.callId,
      kind: readAnswer.outcome === "allow" ? "Read" : "Read (blocked)",
      target: readCall.target,
    },
  });

  const writeCall = {
    callId: `${sessionId}-c2`,
    kind: "file-write",
    target: "TODO-done.md",
    title: "Edit",
  };
  const writeAnswer = await requestPermission(writeCall, true);
  notify(sessionId, {
    type: "tool",
    block:
      writeAnswer.outcome === "allow"
        ? { id: writeCall.callId, kind: "Edit", target: writeCall.target, added: 1, removed: 0 }
        : { id: writeCall.callId, kind: "Edit (blocked)", target: writeCall.target },
  });

  notify(sessionId, { type: "telemetry", telemetry: { tokensIn: 42, tokensOut: 128, runtimeMs: 1000 } });
  notify(sessionId, { type: "status", status: "done" });
  notify(sessionId, { type: "done" });
}

async function handleRequest(msg) {
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      // Negotiate the protocol version. A real bridge would clamp to the
      // highest version it supports; we agree on the client's version when we
      // can speak it, otherwise reply with our own (the client fails fast).
      const clientVersion = params?.protocolVersion;
      initialized = true;
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: clientVersion === PROTOCOL_VERSION ? clientVersion : PROTOCOL_VERSION,
          agentCapabilities: {
            loadSession: false,
            promptCapabilities: { image: false, embeddedContext: true },
          },
        },
      });
      return;
    }
    // Standard ACP: every session method requires a prior successful initialize.
    if (!initialized) {
      send({
        jsonrpc: "2.0",
        id,
        error: { code: -32002, message: `${method} before initialize` },
      });
      return;
    }
    if (method === "session/new") {
      const sessionId = params?.sessionId ?? `acp-${id}`;
      send({ jsonrpc: "2.0", id, result: { sessionId } });
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
  // A response to one of OUR permission requests.
  if (msg.id !== undefined && msg.method === undefined) {
    const resolve = pending.get(msg.id);
    if (resolve) {
      pending.delete(msg.id);
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
