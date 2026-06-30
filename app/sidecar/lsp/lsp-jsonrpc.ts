/**
 * LSP JSON-RPC framing codec (road-to-actually-works P5).
 *
 * The Language Server Protocol frames each message as
 *   `Content-Length: <n>\r\n\r\n<json>`
 * over stdio — NOT the NDJSON the sidecar's own IPC uses. This is the pure
 * framing layer: `encode` for outbound, `LspDecoder` for the inbound byte
 * stream (which arrives in arbitrary chunks — one read may hold a partial
 * header, several messages, or a body split mid-way). Pure + unit-tested; the
 * transport (spawn via the process supervisor) lives in lsp-host.ts.
 */

export interface JsonRpcMessage {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/** Frame one message for the wire. */
export function encode(msg: JsonRpcMessage): string {
  const body = JSON.stringify(msg);
  // Content-Length counts bytes; the body here is ASCII/UTF-8 — use byte length.
  const len = Buffer.byteLength(body, "utf8");
  return `Content-Length: ${len}\r\n\r\n${body}`;
}

/**
 * Streaming decoder. Feed it raw stdout chunks; it returns every COMPLETE
 * message it can extract, buffering the remainder for the next push.
 */
export class LspDecoder {
  #buf = "";

  /** Drop the buffered partial frame — used when the server connection is torn
   *  down (crash-restart): a half-message from the dead process is garbage. */
  reset(): void {
    this.#buf = "";
  }

  push(chunk: string): JsonRpcMessage[] {
    this.#buf += chunk;
    const out: JsonRpcMessage[] = [];
    for (;;) {
      const headerEnd = this.#buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) break; // headers not complete yet
      const header = this.#buf.slice(0, headerEnd);
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        // Malformed header — drop up to the separator and resync.
        this.#buf = this.#buf.slice(headerEnd + 4);
        continue;
      }
      const len = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      // Content-Length is in bytes; slice by bytes to be exact for multibyte.
      const rest = Buffer.from(this.#buf.slice(bodyStart), "utf8");
      if (rest.length < len) break; // body not fully arrived yet
      const body = rest.subarray(0, len).toString("utf8");
      const consumedChars = bodyStart + Buffer.from(body, "utf8").toString("utf8").length;
      // Recompute remainder by bytes to avoid char/byte drift on multibyte bodies.
      const remainderBytes = rest.subarray(len);
      this.#buf = remainderBytes.toString("utf8");
      void consumedChars;
      try {
        out.push(JSON.parse(body) as JsonRpcMessage);
      } catch {
        // Ignore an unparseable body; framing already resynced past it.
      }
    }
    return out;
  }
}
