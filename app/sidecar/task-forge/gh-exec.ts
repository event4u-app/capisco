/**
 * Read-only `gh` (GitHub CLI) exec primitive (road-to-real-breadth P0).
 *
 * The audited home for the read-only GitHub calls the RealForgeProvider uses,
 * under the user's existing `gh` login (no token entry — the auth lives in gh's
 * own keychain). Posture mirrors git-exec/docker-exec: NEVER through a shell —
 * execFile with a discrete argv array; a mutating-verb guard refuses any state
 * change (pr create/merge/close, api -X POST, …) so this can only READ.
 */

import { execFile } from "node:child_process";

const TIMEOUT_MS = 15_000;
const MAX_BUFFER = 16 * 1024 * 1024;

/** First-token verbs that mutate — refused so this stays read-only. */
const MUTATING_VERBS = new Set(["auth", "secret", "release", "workflow", "ssh-key", "gpg-key"]);
/** Subcommands that mutate within an allowed namespace (pr/issue/repo). */
const MUTATING_SUB = new Set(["create", "merge", "close", "reopen", "edit", "delete", "comment", "review", "ready", "lock", "unlock", "rename", "transfer", "fork", "clone", "sync"]);

export class GhError extends Error {}

function refuseMutating(args: readonly string[]): void {
  const [verb, sub] = args;
  if (verb === "api") {
    // Refuse non-GET api calls.
    if (args.some((a) => a === "-X" || a === "--method")) {
      throw new GhError("refused: gh api with an explicit method (read-only primitive)");
    }
    return;
  }
  if (verb && MUTATING_VERBS.has(verb)) throw new GhError(`refused mutating gh verb: ${verb}`);
  if (sub && MUTATING_SUB.has(sub)) throw new GhError(`refused mutating gh subcommand: ${verb} ${sub}`);
}

function run(args: readonly string[], cwd?: string): Promise<string> {
  refuseMutating(args);
  return new Promise((resolve, reject) => {
    execFile("gh", [...args], { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER, encoding: "utf8", cwd }, (err, stdout, stderr) => {
      if (err) reject(new GhError(`gh ${args.join(" ")} failed: ${stderr || err.message}`));
      else resolve(`${stdout}`);
    });
  });
}

/** True when `gh` is installed AND authenticated. */
export async function ghAvailable(): Promise<boolean> {
  try {
    await run(["api", "user", "--jq", ".login"]);
    return true;
  } catch {
    return false;
  }
}

/** The authenticated user's login. */
export async function ghMe(): Promise<string> {
  return (await run(["api", "user", "--jq", ".login"])).trim();
}

/**
 * The `owner/name` of the GitHub repo for the checkout at `cwd` (its remote), or
 * undefined. `gh repo view` reads the remote of its working directory, so we run
 * it with `cwd` set (defaults to the sidecar's cwd = the open project / repo).
 */
export async function ghRepo(cwd?: string): Promise<string | undefined> {
  try {
    const out = await run(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], cwd);
    return out.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** Raw `gh pr list` JSON rows for a repo (read-only). */
export async function ghPrList(repo: string, fields: readonly string[], limit = 100): Promise<unknown[]> {
  const out = await run(["pr", "list", "--repo", repo, "--state", "open", "--limit", String(limit), "--json", fields.join(",")]);
  const parsed: unknown = JSON.parse(out || "[]");
  return Array.isArray(parsed) ? parsed : [];
}
