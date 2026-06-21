/**
 * Real WorkspaceProvider (B1) — projects the primitive {@link GitOpsProvider}
 * git output into the UI-facing {@link WorkspaceProvider} contract shapes
 * (worktrees / change set / diff doc / work-stash / current branch). This is
 * what satisfies the roadmap acceptance: "Explorer/Changes/Commit/Diff run
 * against real git".
 *
 * Scope (road-to-real-git): the *local* git surface is real. Methods that need
 * a remote forge (search via ripgrep, symbol outline via an LSP) are out of B1
 * scope and resolve empty/deterministically; the GitHub-style PR/DORA dashboard
 * stays on its own provider (GitProvider) until road-to-task-forge wires a forge.
 *
 * One provider serves a single worktree rooted at `cwd`; the sidecar registers
 * one per loaded worktree (here, the host repo). No Date.now / Math.random.
 */

import type {
  ChangeFile,
  ChangeSet,
  DiffDoc,
  DiffRow,
  GitFileDiff,
  GitMarker,
  Repo,
  ScratchNode,
  SearchResult,
  SymbolNode,
  WorkspaceProvider,
  WorkStash,
  Worktree,
} from "@/contracts";
import { basename, dirname, extname } from "node:path";
import type { RealGitProvider } from "./real-git-provider.ts";

export interface RealWorkspaceOptions {
  /** The worktree's filesystem root. */
  cwd: string;
  /** The git porcelain provider. */
  git: RealGitProvider;
  /** Repo id/name for the projected worktree (defaults derived from cwd). */
  repoId?: string;
  repoName?: string;
}

/** Map a porcelain status pair to the single-letter UI marker. */
function toMarker(staged: string, unstaged: string): GitMarker {
  if (staged === "A" || unstaged === "?") return "A";
  if (staged === "D" || unstaged === "D") return "D";
  if (staged === "U" || unstaged === "U") return "U";
  return "M";
}

function extOf(path: string): string {
  const e = extname(path).replace(/^\./, "");
  return e || "txt";
}

export class RealWorkspaceProvider implements WorkspaceProvider {
  private readonly cwd: string;
  private readonly git: RealGitProvider;
  private readonly repoId: string;
  private readonly repoName: string;

  constructor(opts: RealWorkspaceOptions) {
    this.cwd = opts.cwd;
    this.git = opts.git;
    this.repoName = opts.repoName ?? basename(opts.cwd);
    this.repoId = opts.repoId ?? this.repoName;
  }

  async listRepos(): Promise<Repo[]> {
    const branch = await this.git.currentBranch(this.cwd);
    return [
      {
        id: this.repoId,
        name: this.repoName,
        defaultBranch: branch,
      },
    ];
  }

  async listWorktrees(): Promise<Worktree[]> {
    const [status, branches] = await Promise.all([
      this.git.status(this.cwd),
      this.git.branches(this.cwd),
    ]);
    const tracking =
      status.ahead || status.behind
        ? `${status.ahead ? `↑${status.ahead}` : ""}${status.behind ? `↓${status.behind}` : ""}`
        : undefined;
    const base = branches.find((b) => b.current)?.upstream?.split("/").pop() ?? status.branch;
    // Build a flat file list from the change entries (real tree-walk is the
    // Explorer's job later; the Changes-relevant files are what B1 needs).
    const files = status.entries.map((e) => ({
      depth: 1,
      ext: extOf(e.path),
      name: basename(e.path),
      git: toMarker(e.staged, e.unstaged),
    }));
    return [
      {
        id: this.repoId,
        repoId: this.repoId,
        name: this.repoName,
        path: this.cwd,
        branch: status.branch,
        base,
        tracking,
        expanded: true,
        selected: true,
        files,
      },
    ];
  }

  // Scratches are a global UI concept, not a git concept — empty under real git.
  listScratches(): Promise<ScratchNode[]> {
    return Promise.resolve([]);
  }

  async getDiff(file?: string): Promise<DiffDoc> {
    const diffs = await this.git.diff(this.cwd, file ? { path: file } : {});
    const fd = file ? diffs.find((d) => d.path === file) ?? diffs[0] : diffs[0];
    if (!fd) {
      return { file: file ?? "", ext: extOf(file ?? ""), added: 0, removed: 0, rows: [] };
    }
    return this.toDiffDoc(fd);
  }

  /** Project a {@link GitFileDiff} into the side-by-side {@link DiffDoc}. */
  private toDiffDoc(fd: GitFileDiff): DiffDoc {
    const rows: DiffRow[] = [];
    for (const h of fd.hunks) {
      let oldN = h.oldStart;
      let newN = h.newStart;
      for (const ln of h.lines) {
        const text = ln.slice(1);
        if (ln.startsWith("+")) {
          rows.push({ l: null, r: { n: newN++, t: text }, k: "add" });
        } else if (ln.startsWith("-")) {
          rows.push({ l: { n: oldN++, t: text }, r: null, k: "del" });
        } else {
          rows.push({ l: { n: oldN++, t: text }, r: { n: newN++, t: text }, k: "ctx" });
        }
      }
    }
    return { file: fd.path, ext: extOf(fd.path), added: fd.added, removed: fd.removed, rows };
  }

  async getChangeSet(): Promise<ChangeSet> {
    const [status, branches] = await Promise.all([
      this.git.status(this.cwd),
      this.git.branches(this.cwd),
    ]);
    const files: ChangeFile[] = await Promise.all(
      status.entries.map(async (e) => {
        const d = await this.git.diff(this.cwd, { path: e.path });
        const fd = d[0];
        return {
          name: basename(e.path),
          path: dirname(e.path) === "." ? "." : dirname(e.path),
          ext: extOf(e.path),
          git: toMarker(e.staged, e.unstaged),
          added: fd?.added ?? 0,
          removed: fd?.removed ?? 0,
        };
      }),
    );
    return {
      hasPullRequest: false,
      branches: branches.map((b) => ({
        id: b.name,
        name: b.name,
        role: b.current ? ("parent" as const) : undefined,
      })),
      files,
    };
  }

  getCurrentBranch(): Promise<string> {
    return this.git.currentBranch(this.cwd);
  }

  async getWorkStash(): Promise<WorkStash> {
    const status = await this.git.status(this.cwd);
    const files: ChangeFile[] = await Promise.all(
      status.entries.map(async (e) => {
        const d = await this.git.diff(this.cwd, { path: e.path });
        const fd = d[0];
        return {
          name: basename(e.path),
          path: dirname(e.path) === "." ? "." : dirname(e.path),
          ext: extOf(e.path),
          git: toMarker(e.staged, e.unstaged),
          added: fd?.added ?? 0,
          removed: fd?.removed ?? 0,
        };
      }),
    );
    return {
      commitBranch: status.branch,
      groups: files.length
        ? [{ project: this.repoName, branch: status.branch, files }]
        : [],
      // Real `git stash list` projection is a follow-up; the work-stash shelf
      // is the local-changes group above. Empty shelf is honest under B1.
      shelf: [],
    };
  }

  // Out of B1 scope: ripgrep search + LSP symbol outline. Honest empties.
  getSearch(): Promise<SearchResult> {
    return Promise.resolve({ query: "", files: [] });
  }

  // The `file` param is part of the WorkspaceProvider signature; B1 has no LSP
  // so the outline is empty regardless of which file. (Structural typing lets a
  // zero-arg method satisfy `(file: string) => …`.)
  getStructure(): Promise<SymbolNode[]> {
    return Promise.resolve([]);
  }
}
