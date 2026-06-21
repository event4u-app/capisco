import type { RecentProject, RecentProjectsProvider } from "@/contracts";

/**
 * Deterministic in-memory Recent-Projects registry (B0 Phase 2 fallback). The
 * browser-only app has no machine-wide file; this mock seeds a few cross-IDE
 * entries so the project switcher can surface "other instances / projects". The
 * sidecar swaps in the real file-backed store (`createFileRecentProjects`)
 * behind the same contract. Deterministic ordinal `lastSeen` — no wall-clock.
 */

const SEED: RecentProject[] = [
  {
    path: "/Users/dev/work/capisco",
    name: "capisco",
    branch: "main",
    lastSeen: 3,
    instanceId: "this-window",
    active: true,
  },
  {
    path: "/Users/dev/work/core-api",
    name: "core-api",
    branch: "feat/broker",
    lastSeen: 2,
    instanceId: "window-2",
    active: true,
  },
  {
    path: "/Users/dev/work/design-system",
    name: "design-system",
    branch: "release/4.2",
    lastSeen: 1,
    instanceId: "window-3",
    active: false,
  },
];

export function createInMemoryRecentProjects(
  seed: RecentProject[] = SEED,
): RecentProjectsProvider {
  const projects: RecentProject[] = seed.map((p) => ({ ...p }));
  let tick = projects.reduce((m, p) => Math.max(m, p.lastSeen), 0);

  return {
    list() {
      return Promise.resolve([...projects].sort((a, b) => b.lastSeen - a.lastSeen));
    },
    touch(entry) {
      const lastSeen = ++tick;
      const next: RecentProject = {
        path: entry.path,
        name: entry.name ?? entry.path.split("/").pop() ?? entry.path,
        branch: entry.branch,
        lastSeen,
        instanceId: entry.instanceId,
        active: entry.active ?? true,
      };
      const idx = projects.findIndex((p) => p.path === entry.path);
      if (idx === -1) projects.push(next);
      else projects[idx] = next;
      return Promise.resolve(next);
    },
    release(instanceId) {
      let cleared = 0;
      for (const p of projects) {
        if (p.instanceId === instanceId && p.active) {
          p.active = false;
          cleared++;
        }
      }
      return Promise.resolve(cleared);
    },
  };
}

/** The default mock recent-projects registry (this-window + two others). */
export const mockRecentProjects: RecentProjectsProvider = createInMemoryRecentProjects();

/** Stable id for "this window" in the mock fallback. */
export const THIS_INSTANCE_ID = "this-window";
