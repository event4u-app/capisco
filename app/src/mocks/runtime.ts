/**
 * Deterministic FakeRuntimeProvider (B2 Phase 1, road-to-worktree-runtime).
 *
 * Container runtime is deferred (no Docker daemon here). This fake implements
 * the {@link RuntimeProvider} contract by replaying a fixed, scripted sequence
 * of `docker stats`-shaped frames — no Date.now, no Math.random, no real timers.
 * The Services view runs against this provider seam; the real Docker/Podman
 * adapter is a thin swap behind the same interface.
 *
 * Frames are deterministic: each subscriber gets the exact same finite sequence,
 * delivered on microtasks (queueMicrotask) so tests can await it without fake
 * timers. The snapshot (`listServices`) is the first stats tick per container.
 */

import type {
  PortAllocator,
  PortReservation,
  RuntimeProvider,
  RuntimeStatsFrame,
  ServiceStat,
  Unsubscribe,
} from "@/contracts";

/**
 * The scripted stats sequence (mirrors the prototype CONTAINER_GROUPS shape so
 * the Services view looks identical to the old hardcoded mock). Each container
 * gets two frames — an initial tick and a "next" tick with drifted CPU/mem — so
 * a subscriber observes movement deterministically.
 */
const STATS_SCRIPT: RuntimeStatsFrame[] = [
  {
    project: "capisco-core",
    name: "web",
    image: "node:22",
    status: "running",
    cpu: 34,
    mem: "412 MB",
    memPct: 41,
    ports: "5173→5173",
    uptime: "2h 14m",
  },
  {
    project: "capisco-core",
    name: "postgres",
    image: "postgres:16",
    status: "running",
    cpu: 2,
    mem: "96 MB",
    memPct: 10,
    ports: "5432→5432",
    uptime: "3d",
  },
  {
    project: "capisco-core",
    name: "traefik",
    image: "traefik:v3",
    status: "running",
    cpu: 1,
    mem: "48 MB",
    memPct: 5,
    ports: "80, 443",
    uptime: "3d",
  },
  {
    project: "capisco-core",
    name: "playwright",
    image: "playwright:1.49",
    status: "exited",
    cpu: 0,
    mem: "0 MB",
    memPct: 0,
    ports: "—",
    uptime: "—",
  },
  {
    project: "capisco-tauri",
    name: "tauri-build",
    image: "rust:1.81",
    status: "running",
    cpu: 8,
    mem: "128 MB",
    memPct: 13,
    ports: "—",
    uptime: "2h 14m",
  },
  {
    project: "capisco-tauri",
    name: "redis",
    image: "redis:7",
    status: "running",
    cpu: 1,
    mem: "24 MB",
    memPct: 3,
    ports: "6379→6379",
    uptime: "2h 14m",
  },
  // Second tick — same containers, drifted CPU/mem (deterministic movement).
  {
    project: "capisco-core",
    name: "web",
    image: "node:22",
    status: "running",
    cpu: 41,
    mem: "438 MB",
    memPct: 44,
    ports: "5173→5173",
    uptime: "2h 15m",
  },
  {
    project: "capisco-core",
    name: "postgres",
    image: "postgres:16",
    status: "running",
    cpu: 3,
    mem: "97 MB",
    memPct: 10,
    ports: "5432→5432",
    uptime: "3d",
  },
  {
    project: "capisco-tauri",
    name: "tauri-build",
    image: "rust:1.81",
    status: "running",
    cpu: 12,
    mem: "140 MB",
    memPct: 14,
    ports: "—",
    uptime: "2h 15m",
  },
];

function frameToStat(f: RuntimeStatsFrame): ServiceStat {
  return {
    name: f.name,
    image: f.image,
    status: f.status,
    cpu: f.cpu,
    mem: f.mem,
    memPct: f.memPct,
    ports: f.ports,
    uptime: f.uptime,
  };
}

/**
 * Deterministic port allocator (stub). Hands out ports from a fixed range in
 * order, tracks owners, releases on demand. No OS binding — the real runtime
 * adapter probes actual availability; this is the reservation seam until then.
 */
export class StubPortAllocator implements PortAllocator {
  private readonly start: number;
  private readonly end: number;
  private next: number;
  private readonly active = new Map<number, PortReservation>();

  constructor(start = 49152, end = 49251) {
    this.start = start;
    this.end = end;
    this.next = start;
  }

  allocate(owner: string): PortReservation {
    // Find the next free port from `next`, wrapping once across the range.
    for (let i = 0; i < this.end - this.start + 1; i++) {
      const candidate =
        this.start + ((this.next - this.start + i) % (this.end - this.start + 1));
      if (!this.active.has(candidate)) {
        this.next = candidate + 1;
        const reservation: PortReservation = {
          port: candidate,
          owner,
          release: () => {
            this.active.delete(candidate);
          },
        };
        this.active.set(candidate, reservation);
        return reservation;
      }
    }
    throw new Error(`port allocator exhausted (range ${this.start}-${this.end})`);
  }

  reservations(): PortReservation[] {
    return [...this.active.values()];
  }
}

export class FakeRuntimeProvider implements RuntimeProvider {
  private readonly allocator = new StubPortAllocator();

  listServices(): Promise<{ project: string; services: ServiceStat[] }[]> {
    // Snapshot = first tick per container (the leading unique-by-name frames).
    const seen = new Map<string, RuntimeStatsFrame>();
    for (const f of STATS_SCRIPT) {
      const k = `${f.project}/${f.name}`;
      if (!seen.has(k)) seen.set(k, f);
    }
    const byProject = new Map<string, ServiceStat[]>();
    for (const f of seen.values()) {
      const arr = byProject.get(f.project) ?? [];
      arr.push(frameToStat(f));
      byProject.set(f.project, arr);
    }
    return Promise.resolve(
      [...byProject.entries()].map(([project, services]) => ({ project, services })),
    );
  }

  subscribeStats(listener: (frame: RuntimeStatsFrame) => void): Unsubscribe {
    let active = true;
    let i = 0;
    const pump = () => {
      if (!active || i >= STATS_SCRIPT.length) return;
      listener(STATS_SCRIPT[i]);
      i++;
      queueMicrotask(pump);
    };
    queueMicrotask(pump);
    return () => {
      active = false;
    };
  }

  ports(): PortAllocator {
    return this.allocator;
  }
}

/** The default fake runtime instance the Services view + sidecar register. */
export const fakeRuntimeProvider = new FakeRuntimeProvider();
