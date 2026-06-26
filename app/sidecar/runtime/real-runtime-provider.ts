/**
 * Real Docker runtime provider (road-to-real-runtime P0).
 *
 * Replaces FakeRuntimeProvider's fabricated frames with the REAL docker daemon:
 *  - one-shot `docker ps` + `docker stats --no-stream`, joined and grouped by
 *    compose project, through the read-only docker-exec primitive.
 *  - listServices() returns the grouped snapshot; subscribeStats() polls the same
 *    snapshot on an interval and emits per-container frames (the streaming
 *    `docker stats` is TTY-finicky in a pipe; a 2s poll of the proven --no-stream
 *    path is real docker, deterministic, and what the ctop view consumes).
 *
 * Honest degrade: daemon unreachable → listServices returns [] and subscribeStats
 * emits nothing (the doctor reports docker missing).
 */

import type {
  ContainerStatus,
  PortAllocator,
  PortReservation,
  RuntimeProvider,
  RuntimeStatsFrame,
  ServiceStat,
  SignalItem,
  SignalSeverity,
  Unsubscribe,
} from "@/contracts";

import { dockerExec, parseNdjson } from "./docker-exec.ts";

interface PsRow {
  ID: string;
  Image: string;
  Names: string;
  Labels: string;
  State: string;
  Status: string;
  Ports: string;
}
interface StatRow {
  Name: string;
  CPUPerc: string;
  MemUsage: string;
  MemPerc: string;
}

function statusOf(state: string): ContainerStatus {
  if (state === "running") return "running";
  if (state === "exited" || state === "created" || state === "paused") return "exited";
  return "error";
}

function labelValue(labels: string, key: string): string | undefined {
  for (const pair of labels.split(",")) {
    const eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq) === key) return pair.slice(eq + 1);
  }
  return undefined;
}

function pct(s: string): number {
  const n = parseFloat(`${s}`.replace("%", "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** "412MiB / 15.5GiB" → "412MiB" (used side only). */
function usedMem(memUsage: string): string {
  return `${memUsage}`.split("/")[0]?.trim() ?? "0";
}

/** "Up 2 hours (healthy)" → "2 hours". */
function uptimeOf(status: string): string {
  return `${status ?? ""}`.replace(/^Up\s+/, "").split("(")[0]?.trim() || "—";
}

/** Minimal real host-port allocator (hands out from a range, tracks reservations). */
class HostPortAllocator implements PortAllocator {
  #next: number;
  readonly #reservations = new Map<number, PortReservation>();
  constructor(base = 43000) {
    this.#next = base;
  }
  allocate(owner: string): PortReservation {
    while (this.#reservations.has(this.#next)) this.#next++;
    const port = this.#next++;
    const res: PortReservation = { port, owner, release: () => this.#reservations.delete(port) };
    this.#reservations.set(port, res);
    return res;
  }
  reservations(): PortReservation[] {
    return [...this.#reservations.values()].sort((a, b) => a.port - b.port);
  }
}

export interface RealRuntimeProviderOptions {
  /** Stats poll interval in ms (subscribeStats). Default 2000. */
  pollMs?: number;
}

export class RealRuntimeProvider implements RuntimeProvider {
  readonly #allocator = new HostPortAllocator();
  readonly #pollMs: number;
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(opts: RealRuntimeProviderOptions = {}) {
    this.#pollMs = opts.pollMs ?? 2000;
  }

  /** Real per-container frames: `docker ps` (meta) joined with `docker stats` (cpu/mem). */
  async #frames(): Promise<RuntimeStatsFrame[]> {
    let psRows: PsRow[];
    let statRows: StatRow[];
    try {
      [psRows, statRows] = await Promise.all([
        dockerExec(["ps", "--format", "json"]).then((o) => parseNdjson<PsRow>(o)),
        dockerExec(["stats", "--no-stream", "--format", "json"]).then((o) => parseNdjson<StatRow>(o)),
      ]);
    } catch {
      return [];
    }
    const statByName = new Map(statRows.map((s) => [s.Name, s]));
    return psRows.map((row) => {
      const stat = statByName.get(row.Names);
      return {
        project: labelValue(row.Labels, "com.docker.compose.project") ?? "(standalone)",
        name: labelValue(row.Labels, "com.docker.compose.service") ?? row.Names,
        image: row.Image,
        status: statusOf(row.State),
        cpu: stat ? pct(stat.CPUPerc) : 0,
        mem: stat ? usedMem(stat.MemUsage) : "0",
        memPct: stat ? pct(stat.MemPerc) : 0,
        ports: row.Ports ?? "",
        uptime: uptimeOf(row.Status),
      } satisfies RuntimeStatsFrame;
    });
  }

  async listServices(): Promise<{ project: string; services: ServiceStat[] }[]> {
    const frames = await this.#frames();
    const byProject = new Map<string, ServiceStat[]>();
    for (const f of frames) {
      const svc: ServiceStat = {
        name: f.name,
        image: f.image,
        status: f.status,
        cpu: f.cpu,
        mem: f.mem,
        memPct: f.memPct,
        ports: f.ports,
        uptime: f.uptime,
      };
      const list = byProject.get(f.project) ?? [];
      list.push(svc);
      byProject.set(f.project, list);
    }
    return [...byProject.entries()].map(([project, services]) => ({ project, services }));
  }

  subscribeStats(listener: (frame: RuntimeStatsFrame) => void): Unsubscribe {
    let stopped = false;
    const tick = async (): Promise<void> => {
      if (stopped) return;
      try {
        for (const frame of await this.#frames()) {
          if (!stopped) listener(frame);
        }
      } catch {
        /* transient docker error — try again next tick */
      }
      if (!stopped) this.#timer = setTimeout(() => void tick(), this.#pollMs);
    };
    void tick();
    return () => {
      stopped = true;
      if (this.#timer) clearTimeout(this.#timer);
    };
  }

  ports(): PortAllocator {
    return this.#allocator;
  }

  dispose(): void {
    if (this.#timer) clearTimeout(this.#timer);
  }
}

/** Pure: a container's status → shared-rail severity. running→success, error→warning, exited→idle. */
function severityFor(status: ContainerStatus): SignalSeverity {
  return status === "running" ? "success" : status === "error" ? "warning" : "idle";
}

/** Pure: one service → a shared-rail SignalItem (source `container`). */
export function serviceToSignal(project: string, svc: ServiceStat): SignalItem {
  return {
    id: `container:${project}:${svc.name}`,
    sev: severityFor(svc.status),
    source: "container",
    title: `${svc.name} — ${svc.status}`,
    sub: `${project} · ${svc.image} · cpu ${svc.cpu}% · mem ${svc.mem} · ${svc.uptime}`,
  };
}

/** Pure: grouped service snapshot → SignalItems (the §5.2 container fold). */
export function servicesToSignals(groups: readonly { project: string; services: ServiceStat[] }[]): SignalItem[] {
  return groups.flatMap((g) => g.services.map((s) => serviceToSignal(g.project, s)));
}
