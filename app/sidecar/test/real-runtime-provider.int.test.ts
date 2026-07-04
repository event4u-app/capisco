/**
 * RealRuntimeProvider integration test against the REAL docker daemon.
 *
 * Proves road-to-real-runtime P0's core: real `docker ps` + `docker stats`
 * replace the fabricated FakeRuntimeProvider frames. Skips cleanly when docker
 * is unreachable (CI without a daemon) OR reachable but with no running
 * containers (a standard CI runner) — the container assertions need a real
 * container to be true; they run for real on a host that has one (local /
 * nightly real-dependency). The port-allocator test is pure and always runs.
 */

import { afterEach, describe, expect, it } from "vitest";

import { dockerAvailable, dockerExec } from "../runtime/docker-exec.ts";
import { RealRuntimeProvider } from "../runtime/real-runtime-provider.ts";

/** True when the daemon reports at least one running container (`docker ps -q`). */
async function hasRunningContainers(): Promise<boolean> {
  try {
    const out = await dockerExec(["ps", "-q"]);
    return out.split("\n").some((line) => line.trim().length > 0);
  } catch {
    return false;
  }
}

const available = await dockerAvailable();
// The container-shape assertions below require a live container. Gate on its
// presence so a daemon-without-containers runner skips instead of failing on
// `expected 0 to be greater than 0`.
const run = available && (await hasRunningContainers()) ? it : it.skip;

let provider: RealRuntimeProvider | undefined;
afterEach(() => {
  provider?.dispose();
  provider = undefined;
});

describe("RealRuntimeProvider ↔ real docker daemon", () => {
  run(
    "listServices returns real containers grouped by compose project",
    async () => {
      provider = new RealRuntimeProvider();
      const groups = await provider.listServices();
      // There is at least one project (the test machine has running containers).
      expect(Array.isArray(groups)).toBe(true);
      const services = groups.flatMap((g) => g.services);
      expect(services.length).toBeGreaterThan(0);
      const svc = services[0];
      // Real shape: strings + numbers, status from the real State.
      expect(typeof svc.name).toBe("string");
      expect(typeof svc.image).toBe("string");
      expect(["running", "exited", "error"]).toContain(svc.status);
      expect(typeof svc.cpu).toBe("number");
      expect(typeof svc.memPct).toBe("number");
      // Every group carries a project label (compose project or standalone).
      for (const g of groups) expect(typeof g.project).toBe("string");
    },
    20_000,
  );

  run(
    "subscribeStats streams at least one real frame",
    async () => {
      provider = new RealRuntimeProvider();
      const frame = await new Promise<unknown>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error("no stats frame within 15s")), 15_000);
        const unsub = provider!.subscribeStats((f) => {
          clearTimeout(to);
          unsub();
          resolve(f);
        });
      });
      const f = frame as { name: string; cpu: number; mem: string };
      expect(typeof f.name).toBe("string");
      expect(typeof f.cpu).toBe("number");
      expect(typeof f.mem).toBe("string");
    },
    20_000,
  );

  it("the port allocator hands out distinct ports and tracks them", () => {
    const p = new RealRuntimeProvider();
    const a = p.ports().allocate("sess-a");
    const b = p.ports().allocate("sess-b");
    expect(a.port).not.toBe(b.port);
    expect(a.owner).toBe("sess-a");
    expect(
      p
        .ports()
        .reservations()
        .map((r) => r.port),
    ).toContain(a.port);
    a.release();
    expect(
      p
        .ports()
        .reservations()
        .map((r) => r.port),
    ).not.toContain(a.port);
    p.dispose();
  });
});
