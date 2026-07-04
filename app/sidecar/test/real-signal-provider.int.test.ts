/**
 * Shared signal rail tests (road-to-real-breadth P3, §5.2).
 *  - PURE: the container + PR folds, and the rail's aggregate/dedup/route logic.
 *  - INTEGRATION: the rail fed by the REAL GitHub forge (skips if gh unauth'd) —
 *    a real PR-status signal lands on the rail next to the other sources.
 */

import { describe, expect, it } from "vitest";

import type { PullRequest, ServiceStat, SignalItem } from "@/contracts";
import { ghAvailable } from "../task-forge/gh-exec.ts";
import { createRealForgeProvider, prsToSignals, prToSignal } from "../task-forge/real-forge-provider.ts";
import { serviceToSignal, servicesToSignals } from "../runtime/real-runtime-provider.ts";
import { RealSignalProvider } from "../observability/real-signal-provider.ts";

const ghReady = await ghAvailable();
const run = ghReady ? it : it.skip;

function pr(over: Partial<PullRequest>): PullRequest {
  return {
    num: 1, title: "t", repo: "o/r", branch: "b", author: "alice", draft: false, days: 1,
    checks: "passing", comments: 0, add: 0, del: 0, labels: [], reviews: [], ...over,
  };
}
function svc(over: Partial<ServiceStat>): ServiceStat {
  return { name: "web", image: "nginx", status: "running", cpu: 1, mem: "10MB", memPct: 1, ports: "80", uptime: "1h", ...over };
}

describe("container fold", () => {
  it("maps status → severity and namespaces the id by project", () => {
    expect(serviceToSignal("api", svc({ name: "db", status: "error" }))).toMatchObject({
      id: "container:api:db", source: "container", sev: "warning", title: "db — error",
    });
    expect(serviceToSignal("api", svc({ status: "running" })).sev).toBe("success");
    expect(serviceToSignal("api", svc({ status: "exited" })).sev).toBe("idle");
  });
  it("flattens grouped snapshots", () => {
    const sigs = servicesToSignals([{ project: "api", services: [svc({ name: "a" }), svc({ name: "b" })] }]);
    expect(sigs.map((s) => s.id)).toEqual(["container:api:a", "container:api:b"]);
  });
});

describe("PR fold", () => {
  it("maps checks/review → severity, source `pr`, namespaced id", () => {
    expect(prToSignal(pr({ num: 9, checks: "failing" }))).toMatchObject({ id: "pr:9", source: "pr", sev: "warning" });
    expect(prToSignal(pr({ checks: "pending" })).sev).toBe("waiting");
    expect(prToSignal(pr({ checks: "passing", requested: true })).sev).toBe("waiting");
    expect(prToSignal(pr({ checks: "passing" })).sev).toBe("success");
  });
});

describe("RealSignalProvider — aggregate / dedup / route", () => {
  const obs: SignalItem = { id: "sentry:1", sev: "warning", source: "observability", title: "boom", sub: "x" };

  it("folds all three sources onto one rail, source-tagged", async () => {
    const rail = new RealSignalProvider({
      pr: async () => prsToSignals([pr({ num: 1 }), pr({ num: 2 })]),
      container: async () => servicesToSignals([{ project: "api", services: [svc({ name: "web" })] }]),
      observability: async () => [obs],
    });
    const all = await rail.listSignals();
    expect(new Set(all.map((s) => s.source))).toEqual(new Set(["pr", "container", "observability"]));
    expect(all).toHaveLength(4);
  });

  it("dedups by id (a source re-emitting the same row)", async () => {
    const rail = new RealSignalProvider({ observability: async () => [obs, obs] });
    expect(await rail.listSignals()).toHaveLength(1);
  });

  it("a throwing source never blanks the rail", async () => {
    const rail = new RealSignalProvider({
      pr: async () => { throw new Error("gh down"); },
      observability: async () => [obs],
    });
    expect((await rail.listSignals()).map((s) => s.id)).toEqual(["sentry:1"]);
  });

  it("routes by the dumb rules — pr/container/observability → alerts, none → inspect (no lint source)", async () => {
    const rail = new RealSignalProvider({
      pr: async () => prsToSignals([pr({ num: 1 })]),
      observability: async () => [obs],
    });
    expect((await rail.signalsFor("alerts")).length).toBe(2);
    expect((await rail.signalsFor("inspect")).length).toBe(0);
  });
});

describe("rail ↔ real forge (integration)", () => {
  run(
    "a real PR-status signal lands on the alerts rail",
    async () => {
      const forge = await createRealForgeProvider({ repo: "event4u-app/capisco" });
      const rail = new RealSignalProvider({ pr: async () => prsToSignals(await forge.listPullRequests()) });
      const alerts = await rail.signalsFor("alerts");
      expect(Array.isArray(alerts)).toBe(true);
      for (const s of alerts) {
        expect(s.source).toBe("pr");
        expect(s.id).toMatch(/^pr:\d+$/);
        expect(["waiting", "success", "warning", "idle"]).toContain(s.sev);
      }
    },
    30_000,
  );
});
