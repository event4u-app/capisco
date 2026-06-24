/**
 * JSON-RPC 2.0 message shapes + the Capisco event-stream extension (B0).
 *
 * The sidecar IPC speaks JSON-RPC 2.0 over an NDJSON byte stream (one JSON
 * value per `\n`-terminated line). Two message families travel the wire:
 *
 *  - **Request / Response** — a numbered request expects exactly one response
 *    (result XOR error). This is the provider-method RPC surface (the
 *    `contracts/` mock→real swap point).
 *  - **Notification (event)** — a server-pushed, id-less message. The session
 *    `subscribe` channel (ACP-shaped token/status/tool/permission deltas) rides
 *    these. Notifications never expect a response.
 *
 * Everything here is pure data — no Node, no DOM — so the same module is shared
 * by the Node socket server and the browser/harness client.
 */

export const JSONRPC_VERSION = "2.0" as const;

/** A request id — the client mints monotonically increasing numbers. */
export type RpcId = number;

/** A method call expecting one response. */
export interface RpcRequest<P = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RpcId;
  method: string;
  params?: P;
}

/** A successful response (mutually exclusive with {@link RpcErrorResponse}). */
export interface RpcResultResponse<R = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RpcId;
  result: R;
}

/** A JSON-RPC error payload. */
export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** A failed response. */
export interface RpcErrorResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RpcId;
  error: RpcError;
}

export type RpcResponse<R = unknown> = RpcResultResponse<R> | RpcErrorResponse;

/**
 * A server-pushed notification (id-less). The Capisco session event stream uses
 * the reserved method name {@link EVENT_METHOD} with a `{ channel, event }`
 * params shape so a single socket multiplexes many session subscriptions.
 */
export interface RpcNotification<P = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  method: string;
  params?: P;
}

export type RpcMessage = RpcRequest | RpcResultResponse | RpcErrorResponse | RpcNotification;

/** Reserved notification method for the multiplexed event stream. */
export const EVENT_METHOD = "$/event" as const;

/** Params carried by an {@link EVENT_METHOD} notification. */
export interface EventParams<E = unknown> {
  /** The subscription channel (e.g. `session:s1`) the event belongs to. */
  channel: string;
  /** The opaque event payload (a `SessionEvent` for session channels). */
  event: E;
}

/** Standard + Capisco-specific JSON-RPC error codes. */
export const RpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  /** A provider method threw — the handler surfaces it as a structured error. */
  ProviderError: -32000,
} as const;

export type RpcErrorCodeValue = (typeof RpcErrorCode)[keyof typeof RpcErrorCode];

export function isRequest(m: RpcMessage): m is RpcRequest {
  return "method" in m && "id" in m;
}

export function isNotification(m: RpcMessage): m is RpcNotification {
  return "method" in m && !("id" in m);
}

export function isResponse(m: RpcMessage): m is RpcResponse {
  return !("method" in m) && "id" in m;
}

export function isErrorResponse(m: RpcResponse): m is RpcErrorResponse {
  return "error" in m;
}
