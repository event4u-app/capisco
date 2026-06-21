/**
 * Runtime-provider contract (B2 Phase 1, road-to-worktree-runtime).
 *
 * Container runtime (Docker / Podman / Traefik) is the heavyweight Phase-7
 * concern (Konzept §7) and is **deferred** — no Docker daemon in this
 * environment, real routing is its own `later/` roadmap. What lands now is the
 * INTERFACE plus a deterministic {@link FakeRuntimeProvider} that emits
 * scripted `docker stats`-shaped frames, so the Services view runs against a
 * real provider seam instead of a hardcoded mock array. The real Docker/Podman
 * adapter is a thin documented swap behind this same contract (Council: same
 * `contracts/` form, real adapter swaps in later).
 *
 * The provider reuses the {@link ServiceStat}/{@link ContainerStatus} shapes the
 * Services view already consumes (tooling.ts) so no UI shape changes — the
 * stream just feeds the existing rows.
 */

import type { Unsubscribe } from "./agents.ts";
import type { ContainerStatus, ServiceStat } from "./tooling.ts";

/** A live stats frame for one container (one tick of `docker stats`). */
export interface RuntimeStatsFrame {
  /** Project/compose-group the container belongs to (Services view groups by this). */
  project: string;
  /** Container name (stable id within a project). */
  name: string;
  image: string;
  status: ContainerStatus;
  /** CPU percentage this tick (0–100, may exceed on multi-core — clamped by UI). */
  cpu: number;
  /** Human memory string, e.g. "412 MB". */
  mem: string;
  /** Memory as a percentage of the container's limit (0–100). */
  memPct: number;
  /** Published-port string, e.g. "5173→5173" or "—". */
  ports: string;
  /** Human uptime string, e.g. "2h 14m" or "—" when not running. */
  uptime: string;
}

/**
 * A single allocated host-port reservation from the {@link PortAllocator}.
 * Deferred-runtime stub: the allocator hands out ports from a deterministic
 * range so a worktree's services can bind without collision; the real adapter
 * will reconcile against the OS / Traefik later.
 */
export interface PortReservation {
  /** The reserved host port. */
  port: number;
  /** Who the reservation is for (session/worktree/service key) — for release. */
  owner: string;
  /** Release this single reservation back to the pool. Idempotent. */
  release(): void;
}

/**
 * Deterministic host-port allocator (stub). Hands out ports from a fixed range
 * in order, tracks owners, and releases on demand. No OS binding — the real
 * runtime adapter will probe actual availability; until then this is the seam
 * the Services/worktree wiring reserves against.
 */
export interface PortAllocator {
  /** Reserve the next free port for `owner`. Throws if the range is exhausted. */
  allocate(owner: string): PortReservation;
  /** Currently reserved ports, in allocation order. */
  reservations(): PortReservation[];
}

/**
 * The runtime provider seam (deferred-real, fake-now). Reports the current set
 * of containers grouped by project for the Services view, and lets a consumer
 * subscribe to a deterministic stream of stats frames. The real Docker/Podman
 * adapter implements this same interface; the {@link FakeRuntimeProvider}
 * replays scripted frames for hermetic tests and the default UI.
 */
export interface RuntimeProvider {
  /**
   * Snapshot of every container grouped by project — the shape the Services
   * view renders. Equivalent to one `docker ps` + `docker stats` tick.
   */
  listServices(): Promise<{ project: string; services: ServiceStat[] }[]>;
  /**
   * Subscribe to live stats frames. The listener fires once per frame; the fake
   * replays a finite deterministic sequence on microtasks (no Date.now / no
   * Math.random / no real timers in tests). Returns an unsubscribe handle.
   */
  subscribeStats(listener: (frame: RuntimeStatsFrame) => void): Unsubscribe;
  /** The host-port allocator backing this runtime (stub until real Docker). */
  ports(): PortAllocator;
}
