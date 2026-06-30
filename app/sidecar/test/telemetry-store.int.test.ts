/**
 * IDE self-telemetry tests (road-to-real-breadth P3).
 *  - UNIT: strict opt-in (no-op when off), scrubbing (secrets dropped, home → ~),
 *    persistence + reload, monotonic seq.
 *  - IPC: the provider answers over the real socket spine like every other.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import type { TelemetryEvent } from "@/contracts";
import { FileTelemetryStore, scrubValue } from "../telemetry/telemetry-store.ts";
import { PROVIDER_IDS } from "../register-mocks.ts";
import { Sidecar } from "../server/sidecar.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { SocketClientTransport } from "../client/socket-client-transport.ts";

let dir: string;
let path: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "capisco-telemetry-"));
  path = join(dir, "telemetry.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("scrubValue", () => {
  it("drops secret-bearing strings and collapses the home dir", () => {
    expect(scrubValue("token = sk_live_0123456789abcdefghij")).toBeUndefined();
    expect(scrubValue("Authorization: Bearer abcdefghij0123456789")).toBeUndefined();
    expect(scrubValue(`${homedir()}/projects/x`)).toBe("~/projects/x");
    expect(scrubValue(42)).toBe(42);
    expect(scrubValue(true)).toBe(true);
  });
});

describe("FileTelemetryStore — strict opt-in", () => {
  it("is disabled by default and record() is a silent no-op", async () => {
    const t = new FileTelemetryStore(path);
    expect(await t.isEnabled()).toBe(false);
    await t.record("editor.save", { file: "a.ts" });
    expect(await t.list()).toEqual([]);
  });

  it("records only after opt-in; persists + survives reload; monotonic seq", async () => {
    const t = new FileTelemetryStore(path);
    await t.setEnabled(true);
    await t.record("session.start", { backend: "native" });
    await t.record("editor.save", { lines: 12 });

    const reloaded = new FileTelemetryStore(path);
    expect(await reloaded.isEnabled()).toBe(true);
    const events = await reloaded.list();
    expect(events.map((e: TelemetryEvent) => e.seq)).toEqual([1, 2]);
    expect(events[0]).toMatchObject({ kind: "session.start", props: { backend: "native" } });
    expect(events[1].props).toEqual({ lines: 12 });
  });

  it("scrubs props on the way to disk — a secret never lands in the file", async () => {
    const t = new FileTelemetryStore(path);
    await t.setEnabled(true);
    await t.record("auth.try", { token: "secret=abcdefghij0123456789klmnop", path: `${homedir()}/x` });
    const onDisk = readFileSync(path, "utf8");
    expect(onDisk).not.toContain("abcdefghij0123456789");
    expect(onDisk).toContain("~/x");
    const [e] = await t.list();
    expect(e.props.token).toBeUndefined();
    expect(e.props.path).toBe("~/x");
  });

  it("turning telemetry back off stops recording", async () => {
    const t = new FileTelemetryStore(path);
    await t.setEnabled(true);
    await t.record("a", {});
    await t.setEnabled(false);
    await t.record("b", {});
    expect((await t.list()).map((e) => e.kind)).toEqual(["a"]);
  });
});

describe("telemetry provider over the IPC spine", () => {
  let sidecar: Sidecar;
  let socketPath: string;

  beforeEach(async () => {
    socketPath = join(mkdtempSync(join(tmpdir(), "capisco-tmsock-")), ".sidecar.sock");
    sidecar = new Sidecar({ socketPath });
    sidecar.registry.register(PROVIDER_IDS.telemetry, new FileTelemetryStore(path) as never);
    await sidecar.listen();
  });
  afterEach(async () => {
    await sidecar.close();
  });

  it("opt-in → record → list round-trips over the socket", async () => {
    const transport = await SocketClientTransport.connect(socketPath);
    const client = new SidecarClient(transport);
    expect(await client.call(PROVIDER_IDS.telemetry, "isEnabled", [])).toBe(false);
    await client.call(PROVIDER_IDS.telemetry, "setEnabled", [true]);
    await client.call(PROVIDER_IDS.telemetry, "record", ["wire.event", { ok: true }]);
    const events = (await client.call(PROVIDER_IDS.telemetry, "list", [])) as TelemetryEvent[];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ seq: 1, kind: "wire.event", props: { ok: true } });
    transport.close?.();
  });
});
