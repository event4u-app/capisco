/**
 * DAP path translation (road-to-real-runtime P1) — the debugging "Knackpunkt".
 *
 * Step-debugging across a container boundary fails unless a HOST breakpoint path
 * is translated to the path the debugger sees INSIDE the container, and a
 * container stack-frame path is translated back to the host path the editor
 * opens. This module is that translation — and it CONSUMES the canonical P0
 * {@link MountMap} rather than re-deriving the mapping (the council-flagged
 * trap: each phase re-deriving ad-hoc → drift). DAP host / DBGp bridge sit on
 * top of this.
 *
 * Pure + side-effect-free: a {@link DapPathMap} wraps a MountMap (or null for a
 * host-only, non-containerized session, where translation is identity), so it is
 * fixture-testable without a container, a daemon, or a debug adapter.
 */

import type { MountMap } from "./mount-map.ts";

/**
 * Translates debugger paths for one debug session, both directions, off the
 * worktree's {@link MountMap}. When constructed with `null` (debugging directly
 * on the host, no container) every translation is identity — a host-only session
 * needs no remap. A path under no bind (e.g. inside a volume mount, or vendored
 * code outside every mount) also passes through unchanged, kept honest rather
 * than hidden.
 */
export class DapPathMap {
  readonly #mount: MountMap | null;

  constructor(mount: MountMap | null) {
    this.#mount = mount;
  }

  /** Host breakpoint path → the path the in-container debugger sets it at. */
  toDebuggee(hostPath: string): string {
    return this.#mount?.toContainer(hostPath) ?? hostPath;
  }

  /** Container stack-frame path → the host path the editor opens. */
  toEditor(debuggeePath: string): string {
    return this.#mount?.toHost(debuggeePath) ?? debuggeePath;
  }

  /** True when this session actually remaps paths (a container is involved). */
  get containerized(): boolean {
    return this.#mount !== null;
  }
}

/**
 * The address the container's xdebug (DBGp) client connects back to — the IDE
 * listener on the host. OS-dependent: Docker Desktop (macOS / Windows) resolves
 * `host.docker.internal` to the host; on Linux there is no such alias by default,
 * so the container reaches the host via the bridge gateway IP (docker0 default
 * `172.17.0.1`, or a compose-network gateway passed in). Pure: the platform and
 * the Linux gateway are inputs, so it is testable without probing the host.
 */
export function resolveXdebugClientHost(
  platform: NodeJS.Platform = process.platform,
  opts: { linuxGateway?: string } = {},
): string {
  if (platform === "darwin" || platform === "win32") return "host.docker.internal";
  // Linux: the docker bridge gateway. Caller may pass the resolved compose-network
  // gateway; otherwise the default docker0 address.
  return opts.linuxGateway ?? "172.17.0.1";
}
