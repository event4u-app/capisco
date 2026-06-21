/**
 * Minimal RFC6455 WebSocket server transport (DEV-ONLY).
 *
 * The sidecar's production transport is a unix socket; a browser cannot speak
 * that. The dev bridge fronts the same sidecar IPC over a localhost WebSocket so
 * `pnpm dev` reaches the REAL sidecar without Tauri/cargo. This file is a
 * deliberately small, dependency-free server-side WebSocket framing layer
 * (text frames only, no permessage-deflate, no fragmentation reassembly beyond
 * what a JSON-RPC peer ever produces) wrapping an already-upgraded
 * `net.Socket`. It adapts that socket to the duplex byte {@link Transport} the
 * RPC peer layer is written against — identical NDJSON framing to the unix
 * socket, so the exact same peer code paths run.
 *
 * NOT FOR PRODUCTION. No new npm dependency (the project's deliberate
 * no-new-dep posture); this is throwaway dev plumbing. The handshake +
 * accept-key derivation use only `node:crypto`. The bridge that owns this
 * binds 127.0.0.1 only.
 */

import { createHash } from "node:crypto";
import type { Socket } from "node:net";
import type { IncomingMessage } from "node:http";
import type { CloseListener, DataListener, Transport } from "@/lib/sidecar/protocol/transport.ts";

/** The fixed RFC6455 GUID used to derive the Sec-WebSocket-Accept value. */
const WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/** Derive the `Sec-WebSocket-Accept` header from the client key. */
export function computeAcceptKey(secWebSocketKey: string): string {
  return createHash("sha1")
    .update(secWebSocketKey + WS_GUID)
    .digest("base64");
}

/** Whether an HTTP request is a WebSocket upgrade we should accept. */
export function isWebSocketUpgrade(req: IncomingMessage): boolean {
  return (
    (req.headers.upgrade ?? "").toLowerCase() === "websocket" &&
    typeof req.headers["sec-websocket-key"] === "string"
  );
}

const OP_CONT = 0x0;
const OP_TEXT = 0x1;
const OP_BINARY = 0x2;
const OP_CLOSE = 0x8;
const OP_PING = 0x9;
const OP_PONG = 0xa;

/** Encode a single unfragmented text frame (server→client, never masked). */
function encodeTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, "utf8");
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x80 | OP_TEXT, len]);
  } else if (len < 0x10000) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | OP_TEXT;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | OP_TEXT;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function encodeCloseFrame(): Buffer {
  return Buffer.from([0x80 | OP_CLOSE, 0x00]);
}

/**
 * A server-side WebSocket {@link Transport} over an upgraded socket. Performs
 * the handshake in {@link accept}, then frames outbound NDJSON lines as text
 * frames and decodes inbound (masked) client frames back to UTF-8 strings.
 */
export class WsServerTransport implements Transport {
  private isClosed = false;
  private readonly dataListeners = new Set<DataListener>();
  private readonly closeListeners = new Set<CloseListener>();
  private readonly socket: Socket;
  /** Inbound byte accumulator across TCP segment boundaries. */
  private buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

  private constructor(socket: Socket) {
    this.socket = socket;
    socket.on("data", (chunk: Buffer) => this.ingest(chunk));
    const onEnd = (err?: Error): void => this.fireClose(err);
    socket.on("close", () => onEnd());
    socket.on("end", () => onEnd());
    socket.on("error", (err) => onEnd(err));
  }

  /**
   * Complete the WebSocket handshake on an upgraded request and return the
   * transport. Throws if the request is not a valid upgrade.
   */
  static accept(req: IncomingMessage, socket: Socket): WsServerTransport {
    const key = req.headers["sec-websocket-key"];
    if (typeof key !== "string") throw new Error("missing Sec-WebSocket-Key");
    const accept = computeAcceptKey(key);
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.setNoDelay(true);
    return new WsServerTransport(socket);
  }

  get closed(): boolean {
    return this.isClosed;
  }

  send(chunk: string): void {
    if (this.isClosed) throw new Error("WebSocket server transport is closed");
    this.socket.write(encodeTextFrame(chunk));
  }

  onData(listener: DataListener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onClose(listener: CloseListener): () => void {
    this.closeListeners.add(listener);
    return () => this.closeListeners.delete(listener);
  }

  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    try {
      this.socket.write(encodeCloseFrame());
      this.socket.end();
    } catch {
      /* best effort */
    }
    this.fireClose();
  }

  /** Decode as many complete frames as the buffer holds; emit text payloads. */
  private ingest(chunk: Buffer): void {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    for (;;) {
      const frame = this.readFrame();
      if (!frame) break;
      if (frame.opcode === OP_CLOSE) {
        this.close();
        return;
      }
      if (frame.opcode === OP_PING) {
        // Reply pong (echo payload) — keep the dev connection alive.
        const header = Buffer.from([0x80 | OP_PONG, frame.payload.length]);
        this.socket.write(Buffer.concat([header, frame.payload]));
        continue;
      }
      if (frame.opcode === OP_PONG) continue;
      if (frame.opcode === OP_TEXT || frame.opcode === OP_CONT || frame.opcode === OP_BINARY) {
        const text = frame.payload.toString("utf8");
        for (const l of this.dataListeners) l(text);
      }
    }
  }

  /**
   * Parse one frame from the head of the buffer, advancing it. Returns null when
   * the buffer does not yet hold a complete frame. Client→server frames are
   * always masked per RFC6455 — we unmask the payload.
   */
  private readFrame(): { opcode: number; payload: Buffer } | null {
    const buf = this.buffer;
    if (buf.length < 2) return null;
    const opcode = buf[0] & 0x0f;
    const masked = (buf[1] & 0x80) !== 0;
    let len = buf[1] & 0x7f;
    let offset = 2;
    if (len === 126) {
      if (buf.length < offset + 2) return null;
      len = buf.readUInt16BE(offset);
      offset += 2;
    } else if (len === 127) {
      if (buf.length < offset + 8) return null;
      len = Number(buf.readBigUInt64BE(offset));
      offset += 8;
    }
    let mask: Buffer | null = null;
    if (masked) {
      if (buf.length < offset + 4) return null;
      mask = buf.subarray(offset, offset + 4);
      offset += 4;
    }
    if (buf.length < offset + len) return null;
    const raw = buf.subarray(offset, offset + len);
    const payload = Buffer.allocUnsafe(len);
    if (mask) {
      for (let i = 0; i < len; i++) payload[i] = raw[i] ^ mask[i & 3];
    } else {
      raw.copy(payload);
    }
    this.buffer = buf.subarray(offset + len);
    return { opcode, payload };
  }

  private fireClose(err?: Error): void {
    if (this.isClosed && this.closeListeners.size === 0) return;
    this.isClosed = true;
    for (const l of this.closeListeners) l(err);
    this.closeListeners.clear();
  }
}
