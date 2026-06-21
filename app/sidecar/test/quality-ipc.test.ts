import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { Sidecar } from "../server/sidecar.ts";
import { registerQuality, QUALITY_PROVIDER_ID, AI_REVIEW_PROVIDER_ID } from "../register-quality.ts";
import { SidecarClient } from "@/lib/sidecar/client/sidecar-client.ts";
import { SocketClientTransport } from "../client/socket-client-transport.ts";
import { makeEslintFixture, type FixtureWorktree } from "./quality-fixture.ts";
import type { AiReview, QualityRunResult } from "@/contracts";

let wt: FixtureWorktree;
let sidecar: Sidecar;
let socketPath: string;

async function connect(): Promise<SidecarClient> {
  const transport = await SocketClientTransport.connect(socketPath);
  return new SidecarClient(transport);
}

beforeEach(async () => {
  wt = makeEslintFixture();
  socketPath = join(mkdtempSync(join(tmpdir(), "capisco-qsock-")), ".sidecar.sock");
  sidecar = new Sidecar({ socketPath });
  registerQuality(sidecar.registry);
  await sidecar.listen();
});

afterEach(async () => {
  await sidecar.close();
  wt.cleanup();
});

describe("quality runner served over the IPC spine (REAL eslint)", () => {
  it("registers the quality + ai-review providers", () => {
    const ids = sidecar.registry.list();
    expect(ids).toContain(QUALITY_PROVIDER_ID);
    expect(ids).toContain(AI_REVIEW_PROVIDER_ID);
  });

  it("runs eslint over the socket and parses real diagnostics", async () => {
    const client = await connect();
    const result = (await client.call(QUALITY_PROVIDER_ID, "run", [
      wt.dir,
      "eslint",
    ])) as QualityRunResult;
    expect(result.tool).toBe("eslint");
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === "prefer-const")).toBe(true);
    client.close();
  }, 30_000);

  it("folds run results into lint SignalItems over the wire", async () => {
    const client = await connect();
    const result = (await client.call(QUALITY_PROVIDER_ID, "run", [
      wt.dir,
      "eslint",
    ])) as QualityRunResult;
    const signals = (await client.call(QUALITY_PROVIDER_ID, "toSignals", [
      [result],
    ])) as Array<{ source: string; sev: string }>;
    expect(signals).toHaveLength(1);
    expect(signals[0].source).toBe("lint");
    client.close();
  }, 30_000);

  it("AI-review (fake) grounds a review in the tool facts over the wire", async () => {
    const client = await connect();
    const result = (await client.call(QUALITY_PROVIDER_ID, "run", [
      wt.dir,
      "eslint",
    ])) as QualityRunResult;
    const review = (await client.call(AI_REVIEW_PROVIDER_ID, "review", [
      [result],
    ])) as AiReview;
    expect(review.provider).toBe("fake");
    expect(review.findings.length).toBe(result.diagnostics.length);
    expect(review.errorCount).toBeGreaterThan(0);
    client.close();
  }, 30_000);
});
