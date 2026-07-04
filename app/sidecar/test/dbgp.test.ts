import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";

import { DbgpSession } from "../runtime/dbgp.ts";

/**
 * road-to-real-runtime P1 — pure DBGp protocol codec (no socket/container). The
 * fixtures mirror REAL xdebug output (base64-encoded values in CDATA), the same
 * shape the live dbgp.int.test.ts conversation exercises; this leg runs always,
 * the live leg is docker-gated.
 */

/** Frame an XML payload as a DBGp packet: `<len>\0<xml>\0`. */
function packet(xml: string): Buffer {
  const body = Buffer.from(xml, "utf8");
  return Buffer.concat([Buffer.from(`${body.length}\0`), body, Buffer.from("\0")]);
}
const b64 = (s: string): string => Buffer.from(s, "utf8").toString("base64");

class FakeSocket extends EventEmitter {
  written: string[] = [];
  write(s: string): boolean {
    this.written.push(s);
    return true;
  }
  destroy(): void {
    this.emit("close");
  }
  feed(xml: string): void {
    this.emit("data", packet(xml));
  }
  /** Feed one packet split across two chunks — exercises the reassembly buffer. */
  feedSplit(xml: string): void {
    const p = packet(xml);
    const at = Math.floor(p.length / 2);
    this.emit("data", p.subarray(0, at));
    this.emit("data", p.subarray(at));
  }
}

function session(): { sock: FakeSocket; sess: DbgpSession } {
  const sock = new FakeSocket();
  const sess = new DbgpSession(sock as unknown as import("node:net").Socket);
  return { sock, sess };
}

describe("DbgpSession (pure protocol)", () => {
  it("resolves the init packet", async () => {
    const { sock, sess } = session();
    sock.feed(`<?xml version="1.0"?><init fileuri="file:///app/script.php" language="PHP" protocol_version="1.0"/>`);
    await expect(sess.init).resolves.toMatchObject({ command: "" });
  });

  it("frames breakpoint_set with a transaction id and matches the response", async () => {
    const { sock, sess } = session();
    const p = sess.setBreakpoint("file:///app/script.php", 4);
    expect(sock.written[0]).toBe("breakpoint_set -i 1 -t line -f file:///app/script.php -n 4\0");
    sock.feed(`<response command="breakpoint_set" transaction_id="1" id="90001" state="enabled"/>`);
    await expect(p).resolves.toMatchObject({ command: "breakpoint_set", transactionId: 1 });
  });

  it("run resolves on a break with location (filename + lineno), reassembling split packets", async () => {
    const { sock, sess } = session();
    const p = sess.run();
    expect(sock.written[0]).toBe("run -i 1\0");
    sock.feedSplit(
      `<response command="run" transaction_id="1" status="break" reason="ok">` +
        `<xdebug:message filename="file:///app/script.php" lineno="4"/></response>`,
    );
    const r = await p;
    expect(r.status).toBe("break");
    expect(r.lineno).toBe(4);
    expect(r.filename).toBe("file:///app/script.php");
  });

  it("parses base64 (CDATA) variable values from context_get", async () => {
    const { sock, sess } = session();
    const p = sess.contextGet(0);
    expect(sock.written[0]).toBe("context_get -i 1 -d 0\0");
    sock.feed(
      `<response command="context_get" transaction_id="1">` +
        `<property name="$greeting" type="string" encoding="base64"><![CDATA[${b64("hello")}]]></property>` +
        `<property name="$x" type="int" encoding="base64"><![CDATA[${b64("41")}]]></property>` +
        `</response>`,
    );
    const props = await p;
    expect(props.find((x) => x.name === "$greeting")).toMatchObject({ type: "string", value: "hello" });
    expect(props.find((x) => x.name === "$x")).toMatchObject({ type: "int", value: "41" });
  });

  it("parses a call stack from stack_get", async () => {
    const { sock, sess } = session();
    const p = sess.stackGet();
    sock.feed(
      `<response command="stack_get" transaction_id="1">` +
        `<stack level="0" type="file" filename="file:///app/script.php" lineno="4" where="{main}"/>` +
        `</response>`,
    );
    const frames = await p;
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ level: 0, filename: "file:///app/script.php", lineno: 4, where: "{main}" });
  });
});
