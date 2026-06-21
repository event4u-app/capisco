/**
 * Real {@link ProjectFsProvider} (road-to-runnable-dev P1/P2) — the on-disk
 * file tree + file content the live Explorer/editor render, plus the
 * broker-gated editor SAVE (P2). Reads go exclusively through the `fs-exec.ts`
 * first-party READ primitive (the broker-mediated read chokepoint); git markers
 * are folded in from the real `git status`. WRITES (saves) go exclusively
 * through {@link BrokerFsWriter}, whose disk touch runs only inside
 * `broker.execute` — a denied save changes nothing on disk.
 *
 * The mock {@link ProjectFsProvider} stays the browser/visual fallback; this is
 * the thin swap behind the same contract — no UI consumer can tell which side
 * it talks to. One provider serves whichever repo root the UI opens (every
 * method is path-keyed), so opening a project at runtime needs no
 * re-registration.
 */

import type {
  FileContent,
  FileWriteResult,
  FsTreeNode,
  GitMarker,
  OpenedProject,
  ProjectFsProvider,
} from "@/contracts";
import { basename, extname } from "node:path";
import { canonicalRoot, listDir, readText, rootExists } from "./fs-exec.ts";
import type { BrokerFsWriter } from "./fs-write-broker.ts";
import type { RealGitProvider } from "../git/real-git-provider.ts";

/** Directories never walked into — keeps the dev tree usable + reads cheap. */
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  "coverage",
  ".cache",
]);

/** Max nodes returned — a guard against pathological repos exhausting the wire. */
const MAX_NODES = 20000;

function extOf(name: string): string {
  const e = extname(name).replace(/^\./, "");
  return e || "txt";
}

function toMarker(staged: string, unstaged: string): GitMarker {
  if (staged === "A" || unstaged === "?") return "A";
  if (staged === "D" || unstaged === "D") return "D";
  if (staged === "U" || unstaged === "U") return "U";
  return "M";
}

export class RealFsProvider implements ProjectFsProvider {
  private readonly git: RealGitProvider;
  /**
   * Broker-gated writer (P2). When present, {@link writeFile} routes the editor
   * save through `broker.execute`. Absent (a read-only dev boot) → writes are
   * reported `written: false` and never touch disk.
   */
  private readonly writer?: BrokerFsWriter;

  constructor(git: RealGitProvider, writer?: BrokerFsWriter) {
    this.git = git;
    this.writer = writer;
  }

  async openProject(path: string): Promise<OpenedProject> {
    if (!rootExists(path)) {
      throw new Error(`not a directory: ${path}`);
    }
    const root = canonicalRoot(path);
    const isRepo = await this.git.isRepo(root);
    const branch = isRepo ? await this.git.currentBranch(root) : "(no git)";
    return { path: root, name: basename(root), branch, isRepo };
  }

  async getTree(path: string): Promise<FsTreeNode[]> {
    if (!rootExists(path)) throw new Error(`not a directory: ${path}`);
    const root = canonicalRoot(path);

    // Fold in git markers, keyed by repo-relative POSIX path.
    const markers = new Map<string, GitMarker>();
    if (await this.git.isRepo(root)) {
      const status = await this.git.status(root);
      for (const e of status.entries) {
        markers.set(e.path, toMarker(e.staged, e.unstaged));
      }
    }

    const out: FsTreeNode[] = [];
    const walk = (relDir: string, depth: number): void => {
      if (out.length >= MAX_NODES) return;
      let entries;
      try {
        entries = listDir(root, relDir);
      } catch {
        return; // unreadable dir — skip rather than fail the whole tree.
      }
      // Directories first, then files; each alphabetical (locale-stable).
      entries.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });
      for (const entry of entries) {
        if (out.length >= MAX_NODES) return;
        if (entry.isDir && IGNORED_DIRS.has(entry.name)) continue;
        const relPath = relDir === "" ? entry.name : `${relDir}/${entry.name}`;
        out.push({
          relPath,
          name: entry.name,
          ext: entry.isDir ? "dir" : extOf(entry.name),
          depth,
          isDir: entry.isDir,
          git: entry.isDir ? undefined : markers.get(relPath),
        });
        if (entry.isDir) walk(relPath, depth + 1);
      }
    };
    walk("", 0);
    return out;
  }

  async readFile(path: string, relPath: string): Promise<FileContent> {
    const root = canonicalRoot(path);
    const text = readText(root, relPath);
    return { relPath, ext: extOf(relPath), text };
  }

  /**
   * Broker-gated editor save (P2). The disk write happens ONLY inside
   * `broker.execute` (the chokepoint) via {@link BrokerFsWriter}. A broker
   * deny / gate throws inside the writer → we surface `{ written: false }` and
   * the file on disk is unchanged. With no writer wired, the save is gated.
   */
  async writeFile(path: string, relPath: string, text: string): Promise<FileWriteResult> {
    if (!this.writer) {
      return { written: false, relPath, reason: "no broker writer wired" };
    }
    try {
      await this.writer.write(path, relPath, text);
      return { written: true, relPath };
    } catch (err) {
      return { written: false, relPath, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}
