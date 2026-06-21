/**
 * File-backed Recent-Projects registry (B0 Phase 2). A passive, machine-wide
 * JSON file in user-config that any Capisco instance reads/writes. No daemon,
 * no socket mesh — concurrency safety comes from:
 *
 *  - **Atomic writes** — serialise to a unique temp file in the same dir, then
 *    `rename()` over the target. POSIX rename is atomic, so a reader never sees
 *    a half-written file even if two instances write concurrently.
 *  - **Read-merge-write by `path`** — `touch` re-reads the current file, merges
 *    the calling instance's entry by `path` (update-in-place, never duplicate),
 *    and writes the whole set back. Last writer wins per entry; entries owned by
 *    other instances are preserved.
 *
 * The store is sorted most-recent-first by the opaque `lastSeen` ordinal (a
 * logical clock), not wall-clock, so behaviour is deterministic and testable.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { dirname, basename } from "node:path";
import type { RecentProject, RecentProjectsProvider } from "@/contracts";

interface RegistryFile {
  version: 1;
  projects: RecentProject[];
}

function emptyFile(): RegistryFile {
  return { version: 1, projects: [] };
}

function readFile(path: string): RegistryFile {
  if (!existsSync(path)) return emptyFile();
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as RegistryFile;
    if (!parsed || !Array.isArray(parsed.projects)) return emptyFile();
    return parsed;
  } catch {
    // A corrupt file must not crash the IDE — start fresh, the next write heals.
    return emptyFile();
  }
}

/** Atomic write: temp-in-same-dir + rename. */
function writeFileAtomic(path: string, data: RegistryFile, tmpSuffix: () => string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${tmpSuffix()}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  try {
    renameSync(tmp, path);
  } catch (err) {
    if (existsSync(tmp)) {
      try {
        unlinkSync(tmp);
      } catch {
        /* best effort */
      }
    }
    throw err;
  }
}

function sortByRecency(projects: RecentProject[]): RecentProject[] {
  return [...projects].sort((a, b) => b.lastSeen - a.lastSeen);
}

export interface FileRecentProjectsOptions {
  /** Path to the machine-wide registry file. */
  filePath: string;
  /**
   * Logical clock — returns a strictly increasing ordinal for `lastSeen`.
   * Defaults to a process-local counter (deterministic per process); a real
   * deployment can pass a shared monotonic source. NOT wall-clock by default so
   * tests stay deterministic.
   */
  clock?: () => number;
  /** Unique temp-suffix source for the atomic write (defaults to a counter). */
  tmpSuffix?: () => string;
}

export function createFileRecentProjects(
  options: FileRecentProjectsOptions,
): RecentProjectsProvider {
  const { filePath } = options;
  let tick = 0;
  const clock = options.clock ?? (() => ++tick);
  let tmpSeq = 0;
  const tmpSuffix = options.tmpSuffix ?? (() => `${process.pid}.${++tmpSeq}`);

  return {
    list() {
      return Promise.resolve(sortByRecency(readFile(filePath).projects));
    },
    touch(entry) {
      const file = readFile(filePath);
      const lastSeen = clock();
      const next: RecentProject = {
        path: entry.path,
        name: entry.name ?? basename(entry.path),
        branch: entry.branch,
        lastSeen,
        instanceId: entry.instanceId,
        active: entry.active ?? true,
      };
      const idx = file.projects.findIndex((p) => p.path === entry.path);
      if (idx === -1) file.projects.push(next);
      else file.projects[idx] = next;
      writeFileAtomic(filePath, file, tmpSuffix);
      return Promise.resolve(next);
    },
    release(instanceId) {
      const file = readFile(filePath);
      let cleared = 0;
      for (const p of file.projects) {
        if (p.instanceId === instanceId && p.active) {
          p.active = false;
          cleared++;
        }
      }
      if (cleared > 0) writeFileAtomic(filePath, file, tmpSuffix);
      return Promise.resolve(cleared);
    },
  };
}
