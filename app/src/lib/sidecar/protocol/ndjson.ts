/**
 * NDJSON line framing for the JSON-RPC transport (B0).
 *
 * The wire is a raw byte stream (a unix socket, or an in-process pipe in the
 * harness). Messages are newline-delimited JSON: each message is `JSON.stringify`
 * + `"\n"`. The decoder is a stateful buffer that tolerates arbitrary chunk
 * boundaries — a single socket `data` chunk may contain a fraction of one line,
 * several whole lines, or many lines plus a trailing partial — so framing must
 * never assume a chunk equals a message. This is exactly what the framing /
 * backpressure integration tests exercise.
 *
 * Pure: no Node stream, no DOM. The codec works on strings; the socket layer
 * owns encoding to/from bytes (utf-8).
 */

import type { RpcMessage } from "./jsonrpc.ts";

/** A decode outcome: a parsed message, or a framing/parse error for one line. */
export type DecodeResult =
  | { ok: true; message: RpcMessage }
  | { ok: false; raw: string; error: Error };

/** Encode one message to a single NDJSON line (with trailing newline). */
export function encodeLine(message: RpcMessage): string {
  return JSON.stringify(message) + "\n";
}

/**
 * A stateful NDJSON line decoder. Feed it arbitrary string chunks; it yields
 * fully-formed lines as they complete, holding any trailing partial line in its
 * internal buffer until the next chunk. A blank line (`"\n\n"`) is skipped, not
 * surfaced as a parse error — keep-alives stay invisible.
 */
export class NdjsonDecoder {
  private buffer = "";
  /** Hard cap on a single un-terminated line (backpressure / abuse guard). */
  private readonly maxLineBytes: number;

  constructor(maxLineBytes = 16 * 1024 * 1024) {
    this.maxLineBytes = maxLineBytes;
  }

  /**
   * Push a chunk; returns every line that completed within it. A trailing
   * partial line is retained for the next `push`. Throws only when a single
   * un-terminated line exceeds `maxLineBytes` (a runaway peer) — individual
   * malformed JSON lines are returned as `{ ok: false }`, never thrown.
   */
  push(chunk: string): DecodeResult[] {
    this.buffer += chunk;
    if (this.buffer.length > this.maxLineBytes && !this.buffer.includes("\n")) {
      const overflow = this.buffer.length;
      this.buffer = "";
      throw new Error(
        `NDJSON line exceeded ${this.maxLineBytes} bytes (${overflow}) without a terminator`,
      );
    }

    const results: DecodeResult[] = [];
    let nl = this.buffer.indexOf("\n");
    while (nl !== -1) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      if (line.trim().length > 0) {
        results.push(decodeLine(line));
      }
      nl = this.buffer.indexOf("\n");
    }
    return results;
  }

  /** Bytes currently buffered (an in-flight partial line). For tests/metrics. */
  get pending(): number {
    return this.buffer.length;
  }
}

/** Parse a single (newline-stripped) NDJSON line into a result. */
export function decodeLine(line: string): DecodeResult {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (parsed === null || typeof parsed !== "object") {
      return { ok: false, raw: line, error: new Error("NDJSON line was not a JSON object") };
    }
    return { ok: true, message: parsed as RpcMessage };
  } catch (err) {
    return { ok: false, raw: line, error: err instanceof Error ? err : new Error(String(err)) };
  }
}
