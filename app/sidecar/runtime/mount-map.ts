/**
 * Canonical host↔container mount mapping (road-to-real-runtime P0, Council-Trap).
 *
 * THE first-class data structure for `host path ↔ container path`, derived ONCE
 * from a worktree's devcontainer mount config. The council read-through flagged
 * this as a trap: real-runtime P1 (DAP / xdebug) needs to translate a host
 * breakpoint path to the path the debugger sees INSIDE the container — and if
 * each phase re-derives that mapping ad-hoc, they drift. So the derivation lives
 * here and DAP CONSUMES it, never re-computes it.
 *
 * Pure + side-effect-free on purpose: it takes the ALREADY-PARSED devcontainer
 * config object plus the local workspace folder and returns a {@link MountMap}.
 * Reading `devcontainer.json` from disk is the caller's job (the devcontainer
 * lifecycle / DAP host), so this module needs no fs and is fixture-testable
 * without a container or a daemon.
 *
 * Only BIND mounts participate in path translation — a volume mount has no
 * host-path correspondence, so a path under it has no host twin (and vice
 * versa). The workspace mount is always entry[0]: it is the worktree itself,
 * the one a {@link WorkspaceRef.containerRoot} is set from.
 *
 * Host paths are expected canonical (callers pass `workspaceRef(...).key`);
 * matching is path-segment-aware (posix), longest-prefix-wins so a nested mount
 * resolves to its most specific bind.
 */

import { posix } from "node:path";

/** One bind correspondence: an absolute host path mounted at an absolute container path. */
export interface MountEntry {
  readonly hostPath: string;
  readonly containerPath: string;
}

/** Parsed fields of a devcontainer mount string (`source=..,target=..,type=..`). */
export interface ParsedMount {
  source?: string;
  target?: string;
  type?: string;
}

/** The mount-relevant subset of a devcontainer.json (already parsed to an object). */
export interface DevcontainerMountConfig {
  /** Container path the workspace is opened at (default `/workspaces/<basename>`). */
  workspaceFolder?: string;
  /** Explicit workspace bind (`source=..,target=..,type=bind`); overrides the default. */
  workspaceMount?: string;
  /** Extra mounts — docker mount strings or `{source,target,type}` objects. */
  mounts?: Array<string | ParsedMount>;
}

/**
 * Parse a docker/devcontainer mount string (`source=..,target=..,type=..`).
 * Accepts the common aliases (`src`, `dst`/`destination`). Unknown keys ignored.
 */
export function parseMountString(spec: string): ParsedMount {
  const out: ParsedMount = {};
  for (const part of spec.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const val = part.slice(eq + 1).trim();
    if (val === "") continue;
    if (key === "source" || key === "src") out.source = val;
    else if (key === "target" || key === "destination" || key === "dst") out.target = val;
    else if (key === "type") out.type = val;
  }
  return out;
}

/** Substitute the two devcontainer vars relevant to host↔container mapping. */
function substituteVars(value: string, localWorkspaceFolder: string): string {
  return value
    .split("${localWorkspaceFolderBasename}")
    .join(posix.basename(localWorkspaceFolder))
    .split("${localWorkspaceFolder}")
    .join(localWorkspaceFolder);
}

function isBind(type: string | undefined): boolean {
  return (type ?? "bind") === "bind";
}

/** Longest-prefix path translation: `query` under some `from` → the matching `to`. */
function translate(query: string, pairs: readonly { from: string; to: string }[]): string | undefined {
  const q = posix.normalize(query);
  let best: { from: string; to: string; fromNorm: string } | undefined;
  for (const pair of pairs) {
    const fromNorm = posix.normalize(pair.from);
    const prefix = fromNorm.endsWith("/") ? fromNorm : `${fromNorm}/`;
    if (q === fromNorm || q.startsWith(prefix)) {
      if (!best || fromNorm.length > best.fromNorm.length) best = { ...pair, fromNorm };
    }
  }
  if (!best) return undefined;
  const rel = posix.relative(best.fromNorm, q);
  return rel === "" ? posix.normalize(best.to) : posix.join(posix.normalize(best.to), rel);
}

/**
 * The canonical mount mapping for one worktree. Translates a path either way by
 * longest-prefix bind match; returns `undefined` for a path under no bind (e.g.
 * inside a volume mount, or outside every mount).
 */
export class MountMap {
  readonly #entries: readonly MountEntry[];

  constructor(entries: readonly MountEntry[]) {
    this.#entries = [...entries];
  }

  /** Every bind correspondence, in derivation order (workspace mount first). */
  entries(): readonly MountEntry[] {
    return [...this.#entries];
  }

  /** The workspace bind (entry 0) — the worktree's own host↔container roots. */
  workspaceEntry(): MountEntry | undefined {
    return this.#entries[0];
  }

  /** Host path → the path the debugger/tools see inside the container. */
  toContainer(hostPath: string): string | undefined {
    return translate(hostPath, this.#entries.map((e) => ({ from: e.hostPath, to: e.containerPath })));
  }

  /** Container path → its host twin (for mapping a stack frame back to the editor). */
  toHost(containerPath: string): string | undefined {
    return translate(containerPath, this.#entries.map((e) => ({ from: e.containerPath, to: e.hostPath })));
  }
}

/**
 * Derive the {@link MountMap} from a worktree's local path + its devcontainer
 * mount config. The workspace bind is entry 0: an explicit `workspaceMount`
 * wins, else the default bind of the local folder → `workspaceFolder` (or the
 * devcontainer default `/workspaces/<basename>`). Then every additional BIND
 * mount with an absolute source is appended; volume mounts are skipped (no host
 * twin). Devcontainer `${localWorkspaceFolder[Basename]}` vars are substituted.
 */
export function deriveMountMap(input: {
  localWorkspaceFolder: string;
  config?: DevcontainerMountConfig;
}): MountMap {
  const { localWorkspaceFolder } = input;
  const config = input.config ?? {};
  const entries: MountEntry[] = [];

  // 1. Workspace mount (always entry 0).
  if (config.workspaceMount) {
    const m = parseMountString(substituteVars(config.workspaceMount, localWorkspaceFolder));
    if (m.source && m.target && isBind(m.type)) {
      entries.push({ hostPath: m.source, containerPath: m.target });
    }
  } else {
    const target = config.workspaceFolder
      ? substituteVars(config.workspaceFolder, localWorkspaceFolder)
      : posix.join("/workspaces", posix.basename(localWorkspaceFolder));
    entries.push({ hostPath: localWorkspaceFolder, containerPath: target });
  }

  // 2. Additional bind mounts (volume mounts have no host-path correspondence).
  for (const raw of config.mounts ?? []) {
    const m =
      typeof raw === "string"
        ? parseMountString(substituteVars(raw, localWorkspaceFolder))
        : {
            source: raw.source ? substituteVars(raw.source, localWorkspaceFolder) : undefined,
            target: raw.target ? substituteVars(raw.target, localWorkspaceFolder) : undefined,
            type: raw.type,
          };
    if (m.source && m.target && isBind(m.type) && posix.isAbsolute(m.source)) {
      entries.push({ hostPath: m.source, containerPath: m.target });
    }
  }

  return new MountMap(entries);
}
