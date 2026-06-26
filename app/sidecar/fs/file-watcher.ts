/**
 * Debounced, ignore-aware file watcher (road-to-actually-works P4).
 *
 * When the agent or git writes a file, the editor must learn about it so it can
 * reload — WITHOUT clobbering unsaved human edits (the dirty-buffer conflict is
 * the consumer's call; this primitive only reports the change). The council
 * read-through flagged the daily-use traps this guards:
 *  - never watch `node_modules`/`.git` (ignore globs) — watching a whole worktree
 *    otherwise melts under churn;
 *  - debounce, because one logical write fires many fs events (esp. macOS
 *    FSEvents coalescing) and an editor reload-per-event would thrash.
 *
 * The OS watch is injectable (`watchFn`) so the debounce/ignore logic is unit-
 * tested deterministically without touching the real filesystem.
 */

import { watch as fsWatch } from "node:fs";

export interface WatchEvent {
  /** Path relative to the watched root (POSIX-style). */
  path: string;
  type: "change" | "rename";
}

/** Minimal shape of a node fs watcher (so a fake can stand in). */
export interface OsWatcher {
  close(): void;
}
export type WatchFn = (
  root: string,
  onRaw: (eventType: string, filename: string | null) => void,
) => OsWatcher;

export interface FileWatcherOptions {
  /** Paths matching any of these are ignored. Default: node_modules, .git, dist. */
  ignore?: RegExp[];
  /** Coalesce window per path. Default 80ms. */
  debounceMs?: number;
  /** Injectable OS watch (tests pass a fake). Default: recursive fs.watch. */
  watchFn?: WatchFn;
}

const DEFAULT_IGNORE = [/(^|\/)node_modules(\/|$)/, /(^|\/)\.git(\/|$)/, /(^|\/)dist(\/|$)/];

function defaultWatchFn(root: string, onRaw: (t: string, f: string | null) => void): OsWatcher {
  return fsWatch(root, { recursive: true }, (eventType, filename) => {
    onRaw(eventType, typeof filename === "string" ? filename : null);
  });
}

export class FileWatcher {
  readonly #ignore: RegExp[];
  readonly #debounceMs: number;
  readonly #watchFn: WatchFn;
  readonly #timers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(opts: FileWatcherOptions = {}) {
    this.#ignore = opts.ignore ?? DEFAULT_IGNORE;
    this.#debounceMs = opts.debounceMs ?? 80;
    this.#watchFn = opts.watchFn ?? defaultWatchFn;
  }

  #ignored(path: string): boolean {
    return this.#ignore.some((re) => re.test(path));
  }

  /** Watch `root` recursively; returns a stop function. Events are debounced per path. */
  watch(root: string, onEvent: (e: WatchEvent) => void): () => void {
    const os = this.#watchFn(root, (eventType, filename) => {
      if (!filename) return;
      const path = filename.split("\\").join("/"); // normalize win separators
      if (this.#ignored(path)) return;
      const existing = this.#timers.get(path);
      if (existing) clearTimeout(existing);
      const type: WatchEvent["type"] = eventType === "rename" ? "rename" : "change";
      this.#timers.set(
        path,
        setTimeout(() => {
          this.#timers.delete(path);
          onEvent({ path, type });
        }, this.#debounceMs),
      );
    });
    return () => {
      for (const t of this.#timers.values()) clearTimeout(t);
      this.#timers.clear();
      os.close();
    };
  }
}
