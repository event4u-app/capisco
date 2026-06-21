/**
 * Project-local artifact layout (road-to-local-artifact-hygiene Phase 0).
 *
 * THE DESIGN DECISION behind the feature: Capisco writes everything it leaves
 * inside a consumer project under ONE clearly-named path — `.capisco/`. With a
 * single root, keeping the personal parts out of the team's Git is trivial and
 * stays trivial no matter how many artifact types arrive later (the exclude
 * entry never grows into a scattered list). Reference: `agents/tmp/feature-
 * gitignore.txt` ("ein Pfad statt einer wachsenden Liste verstreuter Muster").
 *
 * Persönlich-vs-geteilt boundary (Phase 0 Decision-Gate, PO default):
 *
 *  - **Personal** — window layout, open tabs, local caches. NEVER belong in the
 *    repo → these subpaths go into `.git/info/exclude` (Phase 1):
 *      - `.capisco/local/` — per-developer settings / workspace layout.
 *      - `.capisco/cache/`  — derived, regenerable caches.
 *  - **Shared** — a deliberately committed, team-wide project config (e.g.
 *    "this project uses these language packs / quality tools / worktree
 *    defaults"):
 *      - `.capisco/project.toml` — STAYS versioned, is NEVER excluded.
 *
 * So `.capisco/` is NOT excluded wholesale; only its personal subpaths are. This
 * file is pure constants + path resolution — it performs no I/O. The actual disk
 * write of project-local artifacts is broker-gated like every other fs write
 * (it would flow through the same `file-write` chokepoint as an editor save);
 * the `.git/info/exclude` write is the audited primitive in
 * `git/git-exclude-exec.ts`.
 */

/** The single project-local root all Capisco artifacts live under. */
export const CAPISCO_DIR = ".capisco";

/** Personal (per-developer) settings + workspace layout — excluded from Git. */
export const CAPISCO_LOCAL_DIR = `${CAPISCO_DIR}/local`;

/** Derived, regenerable caches — excluded from Git. */
export const CAPISCO_CACHE_DIR = `${CAPISCO_DIR}/cache`;

/** Deliberately team-shared, committed project config — NEVER excluded. */
export const CAPISCO_SHARED_PROJECT_FILE = `${CAPISCO_DIR}/project.toml`;

/**
 * The PERSONAL project-local subpaths, repo-relative, POSIX-separated. These are
 * exactly the paths the `.git/info/exclude` marked block ignores (Phase 1). The
 * shared `project.toml` is deliberately absent — it stays versioned. Each entry
 * ends with `/` so Git treats it as a directory match.
 */
export const CAPISCO_EXCLUDED_PATHS: readonly string[] = [
  `${CAPISCO_LOCAL_DIR}/`,
  `${CAPISCO_CACHE_DIR}/`,
];

/**
 * Resolve a personal project-local path under `.capisco/local/`. Used by
 * Capisco features that persist per-developer state into the consumer project
 * (window layout, open tabs). Returns a repo-RELATIVE POSIX path; the actual
 * disk write goes through the broker-gated `file-write` chokepoint (path-
 * traversal guarded there), never directly. `name` must not escape the subtree.
 */
export function localArtifactPath(name: string): string {
  return joinUnder(CAPISCO_LOCAL_DIR, name);
}

/**
 * Resolve a regenerable cache path under `.capisco/cache/`. Same posture as
 * {@link localArtifactPath} — repo-relative, written only through the broker.
 */
export function cacheArtifactPath(name: string): string {
  return joinUnder(CAPISCO_CACHE_DIR, name);
}

/** Whether a repo-relative path is one of the personal (excluded) artifacts. */
export function isExcludedArtifact(relPath: string): boolean {
  const norm = normalize(relPath);
  return (
    norm === CAPISCO_LOCAL_DIR ||
    norm === CAPISCO_CACHE_DIR ||
    norm.startsWith(`${CAPISCO_LOCAL_DIR}/`) ||
    norm.startsWith(`${CAPISCO_CACHE_DIR}/`)
  );
}

/** Join `name` under `base`, rejecting any `..`/absolute escape. POSIX result. */
function joinUnder(base: string, name: string): string {
  const norm = normalize(name);
  if (norm === "" || norm === ".." || norm.startsWith("../") || name.startsWith("/")) {
    throw new Error(`project-local artifact name escapes ${base}: ${name}`);
  }
  return `${base}/${norm}`;
}

/** Collapse backslashes and strip a leading `./` — purely lexical, no I/O. */
function normalize(p: string): string {
  return p.split("\\").join("/").replace(/^\.\//, "");
}
