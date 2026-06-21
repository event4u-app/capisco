/**
 * Hermetic temp-repo helper for the real-git integration tests (B1). Creates a
 * throwaway `git init` repo under the OS temp dir with a pinned identity and
 * `init.defaultBranch=main`, so tests are deterministic and machine-independent
 * (no global git config leakage). Every helper takes the repo dir explicitly.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const AUTHOR_NAME = "Test Bot";
const AUTHOR_EMAIL = "bot@capisco.test";

function run(cwd: string, args: string[]): string {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: AUTHOR_NAME,
      GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
      GIT_COMMITTER_NAME: AUTHOR_NAME,
      GIT_COMMITTER_EMAIL: AUTHOR_EMAIL,
    },
  });
}

export interface TempRepo {
  dir: string;
  write(relPath: string, content: string): void;
  git(args: string[]): string;
  commitAll(message: string): string;
  cleanup(): void;
}

export const TEMP_AUTHOR = { name: AUTHOR_NAME, email: AUTHOR_EMAIL };

/** Create an initialized empty repo (no commits) with pinned identity. */
export function makeTempRepo(): TempRepo {
  const dir = mkdtempSync(join(tmpdir(), "capisco-git-"));
  run(dir, ["init", "-q", "-b", "main"]);
  run(dir, ["config", "user.name", AUTHOR_NAME]);
  run(dir, ["config", "user.email", AUTHOR_EMAIL]);
  run(dir, ["config", "commit.gpgsign", "false"]);

  return {
    dir,
    write(relPath: string, content: string): void {
      const full = join(dir, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, "utf8");
    },
    git(args: string[]): string {
      return run(dir, args);
    },
    commitAll(message: string): string {
      run(dir, ["add", "-A"]);
      run(dir, ["commit", "-q", "-m", message]);
      return run(dir, ["rev-parse", "--short", "HEAD"]).trim();
    },
    cleanup(): void {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
