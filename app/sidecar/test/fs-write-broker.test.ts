// @vitest-environment node
/**
 * Broker-gated file-write integration test (road-to-runnable-dev P2 +
 * security must-fix). Proves, hermetically against a temp repo, that:
 *
 *  - A SAVE that the broker clears reaches disk — the file content changes for
 *    real (real `perform` adapter, not a no-op stub).
 *  - A DENIED save produces NO disk change — the file is byte-identical after a
 *    deny-all gate. The write primitive is never reached when the broker denies.
 *  - The disk write is confined to `broker.execute`: the audit records the
 *    `executed` entry, and `RealFsProvider.writeFile` surfaces the gate outcome.
 *
 * This is the closing proof of the review must-fix ("denied capability ⇒ no
 * side effect"); the architecture/lint test (`broker-chokepoint.test.ts`) pins
 * WHERE the fs-write primitive may live, and this test pins that the broker is
 * the only path to it.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AuditEntry } from "@/contracts";
import { Broker } from "../broker/capability-broker.ts";
import { BrokerFsWriter } from "../fs/fs-write-broker.ts";
import { RealGitProvider } from "../git/real-git-provider.ts";
import { RealFsProvider } from "../fs/real-fs-provider.ts";
import { makeTempRepo, type TempRepo } from "./git-temp-repo.ts";

let repo: TempRepo;

beforeEach(() => {
  repo = makeTempRepo();
  repo.write("src/app.ts", "export const answer = 42;\n");
  repo.commitAll("init");
});

afterEach(() => {
  repo.cleanup();
});

function read(rel: string): string {
  return readFileSync(join(repo.dir, rel), "utf8");
}

describe("broker-gated file write — the real perform adapter", () => {
  it("writes to disk for real when the broker clears the save", async () => {
    const broker = new Broker();
    // A human Save resolver clears the `ask` gate (trusted human intent).
    const writer = new BrokerFsWriter({ broker, resolvePermission: () => ({ axis: "session" }) });

    await writer.write(repo.dir, "src/app.ts", "export const answer = 99;\n");

    // The file changed on disk for real.
    expect(read("src/app.ts")).toBe("export const answer = 99;\n");

    // The append-only audit recorded the EXECUTED write (written before the
    // disk touch). There is an authorize record + an executed record.
    const log = broker.audit.list();
    const executed = log.filter((e: AuditEntry) => e.outcome === "executed");
    expect(executed.length).toBe(1);
    expect(executed[0].capability).toBe("file-write");
    expect(executed[0].target).toBe("src/app.ts");
  });

  it("produces NO disk change when the broker denies the save (deny-all gate)", async () => {
    const before = read("src/app.ts");
    const broker = new Broker();
    // Fail-closed deny-all resolver — the default.
    const writer = new BrokerFsWriter({ broker, resolvePermission: () => ({ axis: "deny" }) });

    await expect(writer.write(repo.dir, "src/app.ts", "MALICIOUS\n")).rejects.toThrow();

    // The file is byte-identical — the write primitive was never reached.
    expect(read("src/app.ts")).toBe(before);

    // No `executed` audit entry exists for a denied write.
    const executed = broker.audit.list().filter((e: AuditEntry) => e.outcome === "executed");
    expect(executed.length).toBe(0);
  });

  it("rejects a path-traversal escape from the repo root (no disk change)", async () => {
    const broker = new Broker();
    const writer = new BrokerFsWriter({ broker, resolvePermission: () => ({ axis: "session" }) });
    await expect(
      writer.write(repo.dir, "../../etc/capisco-pwned", "x\n"),
    ).rejects.toThrow(/escapes project root/);
  });

  it("creates a new file in a not-yet-existing sub-tree when cleared", async () => {
    const broker = new Broker();
    const writer = new BrokerFsWriter({ broker, resolvePermission: () => ({ axis: "session" }) });
    await writer.write(repo.dir, "src/nested/new.ts", "export const fresh = true;\n");
    expect(read("src/nested/new.ts")).toBe("export const fresh = true;\n");
  });

  it("RealFsProvider.writeFile surfaces the gate outcome (written vs gated)", async () => {
    const git = new RealGitProvider();

    // Wired with a clearing broker → written:true + disk change.
    const okBroker = new Broker();
    const okWriter = new BrokerFsWriter({
      broker: okBroker,
      resolvePermission: () => ({ axis: "session" }),
    });
    const okFs = new RealFsProvider(git, okWriter);
    const ok = await okFs.writeFile(repo.dir, "src/app.ts", "export const answer = 7;\n");
    expect(ok.written).toBe(true);
    expect(read("src/app.ts")).toBe("export const answer = 7;\n");

    // Wired with a deny-all broker → written:false + NO disk change.
    const before = read("src/app.ts");
    const denyBroker = new Broker();
    const denyWriter = new BrokerFsWriter({
      broker: denyBroker,
      resolvePermission: () => ({ axis: "deny" }),
    });
    const denyFs = new RealFsProvider(git, denyWriter);
    const gated = await denyFs.writeFile(repo.dir, "src/app.ts", "NOPE\n");
    expect(gated.written).toBe(false);
    expect(gated.reason).toBeTruthy();
    expect(read("src/app.ts")).toBe(before);

    // No broker wired at all → also gated, no disk change.
    const noWriterFs = new RealFsProvider(git);
    const noWriter = await noWriterFs.writeFile(repo.dir, "src/app.ts", "ALSO-NOPE\n");
    expect(noWriter.written).toBe(false);
    expect(read("src/app.ts")).toBe(before);
  });
});
