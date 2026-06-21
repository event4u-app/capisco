// @vitest-environment node
/**
 * RTK observation-compressor tests (Phase 3, token-economy) — the acceptance:
 *
 *  1. PARSER-GOLDEN: the pure `parseLongTail` parser maps a frozen long-tail
 *     fixture to the committed expected output (byte-stable at a pinned RTK
 *     version). Plus an end-to-end spawn through the deterministic fixture
 *     filter (the `rtk` stand-in) produces the same compacted text, branded.
 *
 *  2. RTK-DEGRADE-ASSERT: with no `rtk` on PATH, `rtkCompress` returns undefined
 *     and `compressObservation` passes the raw text through (branded,
 *     `compressed:false`) — NO hard-fail. The degrade path only ever sees a
 *     long-tail observation; it runs no substitute logic over a border surface.
 *
 *  3. RTK-NEVER-IN-AUTHORITATIVE-PATH-ASSERT (AK-T1/T2): RTK output is branded
 *     LlmFacingOnly; the broker (`authorize`) and the audit store (`record`)
 *     REFUSE any field carrying the RTK marker. `compressObservation` also
 *     refuses an `authoritative` source outright (a border surface can never be
 *     routed through RTK).
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { Broker } from "../broker/capability-broker.ts";
import { InMemoryAuditStore } from "../broker/audit-store.ts";
import { parseLongTail } from "../rtk/rtk-parse.ts";
import { rtkCompress, rtkAvailable, resolveRtkPath } from "../rtk/rtk-exec.ts";
import { compressObservation } from "../rtk/rtk-compressor.ts";
import { isRtkFiltered, unwrapForModel, brandLlmFacing } from "@/contracts";
import type { CapabilityRequest, Principal } from "@/contracts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_FILTER = join(HERE, "..", "rtk", "rtk-fixture-filter.mjs");
const FIXTURE_DIR = join(HERE, "..", "rtk", "fixtures");
const RAW = readFileSync(join(FIXTURE_DIR, "ls-longtail.raw.txt"), "utf8");
const EXPECTED = readFileSync(join(FIXTURE_DIR, "ls-longtail.expected.txt"), "utf8").replace(
  /\n$/,
  "",
);

const AGENT: Principal = { id: "acp-agent", kind: "agent", label: "Stub" };

describe("RTK parser — golden against frozen long-tail fixture", () => {
  it("compacts the recorded `ls` long-tail to the committed expected output", () => {
    const { text } = parseLongTail(RAW);
    expect(text).toBe(EXPECTED);
  });

  it("is idempotent (running it twice changes nothing)", () => {
    const once = parseLongTail(RAW).text;
    const twice = parseLongTail(once).text;
    expect(twice).toBe(once);
  });
});

describe("RTK exec — spawn through the deterministic fixture filter", () => {
  it("pipes raw → compressed stdout via execFile (no shell)", async () => {
    const out = await rtkCompress(RAW, { command: process.execPath, args: [FIXTURE_FILTER] });
    expect(out).toBe(EXPECTED);
  });

  it("compressObservation brands the result LlmFacingOnly + reports savings", async () => {
    const obs = await compressObservation(RAW, {
      source: "ls-longtail",
      command: process.execPath,
      args: [FIXTURE_FILTER],
    });
    expect(obs.compressed).toBe(true);
    expect(obs.tag).toBe("RtkFiltered");
    expect(isRtkFiltered(obs.text)).toBe(true);
    // The model sees the clean compacted text (marker stripped).
    expect(unwrapForModel(obs.text)).toBe(EXPECTED);
    expect(obs.compressedBytes).toBeLessThan(obs.rawBytes);
  });
});

describe("RTK-DEGRADE-ASSERT — no binary → raw passthrough, no hard-fail", () => {
  it("rtkCompress returns undefined when `rtk` is not installed", async () => {
    // A binary name that resolves nowhere on PATH.
    const out = await rtkCompress(RAW, { command: "rtk-does-not-exist-xyz", env: { PATH: "" } });
    expect(out).toBeUndefined();
  });

  it("compressObservation degrades cleanly: raw text branded, compressed:false", async () => {
    const obs = await compressObservation(RAW, {
      source: "ls-longtail",
      command: "rtk-does-not-exist-xyz",
      env: { PATH: "" },
    });
    expect(obs.compressed).toBe(false);
    expect(obs.tag).toBe("LlmFacingOnly");
    // Raw text preserved verbatim for the model (degrade never loses data).
    expect(unwrapForModel(obs.text)).toBe(RAW);
  });

  it("rtkAvailable / resolveRtkPath report a missing binary without throwing", () => {
    expect(rtkAvailable("rtk-does-not-exist-xyz", { PATH: "" })).toBe(false);
    expect(resolveRtkPath("rtk-does-not-exist-xyz", { PATH: "" })).toBeUndefined();
  });
});

describe("RTK-NEVER-IN-AUTHORITATIVE-PATH-ASSERT (AK-T1/T2)", () => {
  it("compressObservation refuses an authoritative source outright", async () => {
    await expect(
      // "authoritative" is a valid source name but RTK refuses it at runtime —
      // a border surface can never be routed through the compressor.
      compressObservation(RAW, { source: "authoritative" }),
    ).rejects.toThrow(/authoritative/i);
  });

  it("the broker refuses an RTK-filtered target", () => {
    const broker = new Broker();
    const tainted = brandLlmFacing("ls /tmp"); // RTK output, must never be a target
    const request: CapabilityRequest = {
      kind: "shell",
      // Force the branded value into the string slot (a real caller could only do
      // this via an explicit unsafe cast — the brand bars it at compile time).
      target: tainted as unknown as string,
    };
    expect(() => broker.authorize(AGENT, request)).toThrow(/RTK-filtered/i);
  });

  it("the audit store refuses an RTK-filtered field", () => {
    const audit = new InMemoryAuditStore();
    expect(() =>
      audit.record({
        principalId: "agent",
        principalKind: "agent",
        capability: "shell",
        target: brandLlmFacing("docker ps") as unknown as string,
        outcome: "allow",
        fromUntrusted: false,
        reason: "test",
      }),
    ).toThrow(/RTK-filtered/i);
  });

  it("a normal (un-RTK'd) request still authorizes — the guard is targeted", () => {
    const broker = new Broker();
    // A read-only `which` style shell is allowlisted to `ask`/`allow`; the point
    // is it does NOT throw the RTK guard.
    const request: CapabilityRequest = { kind: "file-read", target: "/tmp/x" };
    expect(() => broker.authorize(AGENT, request)).not.toThrow();
  });
});
