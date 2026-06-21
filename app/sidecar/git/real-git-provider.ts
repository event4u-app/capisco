/**
 * Real GitProvider (B1, road-to-real-git) — the production swap for the
 * deterministic git mocks. Implements {@link GitOpsProvider} by shelling out to
 * the system `git` (decision: shell-out over isomorphic-git; system git is
 * present and lets us test hermetically against `git init` temp repos with no
 * new dependency). Parses porcelain v2 status, `--numstat`/unified diffs,
 * `--porcelain` blame, and the `%x00`-delimited pretty log.
 */

import type {
  GitAuthor,
  GitBlameLine,
  GitBranch,
  GitDiffOptions,
  GitFileDiff,
  GitLogEntry,
  GitLogOptions,
  GitOpsProvider,
  GitStatus,
  GitStatusCode,
  GitStatusEntry,
  GitWriteResult,
} from "@/contracts";
import { git } from "./git-exec.ts";
import {
  parseDiff,
  parseLog,
  parsePorcelainBlame,
  parseStatus,
} from "./git-parse.ts";

export class RealGitProvider implements GitOpsProvider {
  async isRepo(cwd: string): Promise<boolean> {
    try {
      const { stdout } = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
      return stdout.trim() === "true";
    } catch {
      return false;
    }
  }

  async status(cwd: string): Promise<GitStatus> {
    // porcelain=v2 + branch headers: stable, machine-parseable, rename-aware.
    const { stdout } = await git(cwd, [
      "status",
      "--porcelain=v2",
      "--branch",
      "--untracked-files=all",
    ]);
    return parseStatus(stdout);
  }

  async diff(cwd: string, options: GitDiffOptions = {}): Promise<GitFileDiff[]> {
    // Two passes: a patch pass for hunks, a --numstat pass for add/removed
    // counts + rename detection. Both share the same ref/path selection.
    const patchArgs = ["diff", "--no-color", "-M"];
    const numstatArgs = ["diff", "--numstat", "-M"];

    if (options.base) {
      patchArgs.push(options.base);
      numstatArgs.push(options.base);
    } else if (options.staged) {
      patchArgs.push("--cached");
      numstatArgs.push("--cached");
    }
    if (options.path) {
      patchArgs.push("--", options.path);
      numstatArgs.push("--", options.path);
    }

    const [{ stdout: patch }, { stdout: numstat }] = await Promise.all([
      git(cwd, patchArgs),
      git(cwd, numstatArgs),
    ]);
    return parseDiff(patch, numstat);
  }

  async log(cwd: string, options: GitLogOptions = {}): Promise<GitLogEntry[]> {
    const limit = options.limit ?? 50;
    // NUL-delimited fields + record separator → robust against any subject text.
    const fmt = ["%H", "%h", "%an", "%ae", "%at", "%P", "%s"].join("%x00");
    const args = [
      "log",
      `--max-count=${limit}`,
      `--pretty=format:${fmt}%x1e`,
    ];
    if (options.ref) args.push(options.ref);
    if (options.path) args.push("--", options.path);
    const { stdout } = await git(cwd, args, { allowFail: true });
    return parseLog(stdout);
  }

  async blame(cwd: string, path: string): Promise<GitBlameLine[]> {
    const { stdout } = await git(cwd, ["blame", "--porcelain", "--", path]);
    return parsePorcelainBlame(stdout);
  }

  async branches(cwd: string): Promise<GitBranch[]> {
    // for-each-ref is stable + scriptable; %(HEAD) marks the current branch.
    const fmt = [
      "%(HEAD)",
      "%(refname:short)",
      "%(objectname:short)",
      "%(upstream:short)",
    ].join("%00");
    const { stdout } = await git(cwd, [
      "for-each-ref",
      `--format=${fmt}`,
      "refs/heads",
    ]);
    const branches: GitBranch[] = [];
    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;
      const [head, name, tip, upstream] = line.split("\0");
      branches.push({
        name,
        current: head === "*",
        tip,
        upstream: upstream || undefined,
      });
    }
    return branches;
  }

  async currentBranch(cwd: string): Promise<string> {
    const { stdout } = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const name = stdout.trim();
    return name === "HEAD" ? "(detached)" : name;
  }

  async stage(cwd: string, paths: string[]): Promise<void> {
    const args = paths.length ? ["add", "--", ...paths] : ["add", "-A"];
    await git(cwd, args);
  }

  async unstage(cwd: string, paths: string[]): Promise<void> {
    // `restore --staged` is the modern unstage; works even on an unborn branch
    // via the `reset` fallback (no HEAD yet → restore errors, reset is a no-op).
    const hasHead = await this.hasCommits(cwd);
    if (!hasHead) {
      const args = paths.length ? ["reset", "--", ...paths] : ["reset"];
      await git(cwd, args, { allowFail: true });
      return;
    }
    const args = paths.length
      ? ["restore", "--staged", "--", ...paths]
      : ["restore", "--staged", "."];
    await git(cwd, args);
  }

  async commit(cwd: string, message: string, author?: GitAuthor): Promise<GitWriteResult> {
    const args = ["commit", "-m", message];
    if (author) {
      args.push("--author", `${author.name} <${author.email}>`);
    }
    // Pin committer identity for hermetic, machine-independent test repos.
    const env = author
      ? {
          GIT_AUTHOR_NAME: author.name,
          GIT_AUTHOR_EMAIL: author.email,
          GIT_COMMITTER_NAME: author.name,
          GIT_COMMITTER_EMAIL: author.email,
        }
      : undefined;
    await this.runWithEnv(cwd, args, env);
    const { stdout } = await git(cwd, ["rev-parse", "--short", "HEAD"]);
    return { ok: true, ref: stdout.trim() };
  }

  async branchCreate(cwd: string, name: string, base?: string): Promise<GitWriteResult> {
    const args = base ? ["branch", name, base] : ["branch", name];
    await git(cwd, args);
    return { ok: true, ref: name };
  }

  async checkout(cwd: string, ref: string, create = false): Promise<GitWriteResult> {
    const args = create ? ["checkout", "-b", ref] : ["checkout", ref];
    await git(cwd, args);
    return { ok: true, ref };
  }

  /** True iff the repo has at least one commit (HEAD resolves). */
  private async hasCommits(cwd: string): Promise<boolean> {
    try {
      await git(cwd, ["rev-parse", "--verify", "HEAD"]);
      return true;
    } catch {
      return false;
    }
  }

  /** `commit` needs an env override for author pinning; reuse the same execFile path. */
  private async runWithEnv(
    cwd: string,
    args: string[],
    env: Record<string, string> | undefined,
  ): Promise<void> {
    if (!env) {
      await git(cwd, args);
      return;
    }
    // git-exec doesn't take env; merge into process.env transiently is unsafe
    // under concurrency. Pass identity via -c flags instead (process-local).
    const cfg: string[] = [
      "-c",
      `user.name=${env.GIT_COMMITTER_NAME}`,
      "-c",
      `user.email=${env.GIT_COMMITTER_EMAIL}`,
    ];
    await git(cwd, [...cfg, ...args]);
  }
}

/** Re-export the status-code type for parser tests. */
export type { GitStatusCode, GitStatusEntry };
