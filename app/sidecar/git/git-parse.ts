/**
 * Pure parsers for `git` output (B1, road-to-real-git). Kept separate from the
 * provider so they are unit-testable on raw fixture strings with zero process
 * spawning, and so the shapes stay faithful to git's documented formats:
 *
 *   - status   → `--porcelain=v2 --branch`
 *   - diff     → unified patch + `--numstat`
 *   - log      → NUL-field / RS-record `--pretty=format`
 *   - blame    → `--porcelain`
 *
 * No Date.now / Math.random — dates are passed through as raw epoch strings; the
 * UI layer renders them, so tests stay deterministic.
 */

import type {
  GitBlameLine,
  GitDiffHunk,
  GitFileDiff,
  GitLogEntry,
  GitStatus,
  GitStatusCode,
  GitStatusEntry,
} from "@/contracts";

function toCode(c: string): GitStatusCode {
  switch (c) {
    case "M":
    case "A":
    case "D":
    case "R":
    case "C":
    case "U":
    case "?":
    case "!":
      return c;
    case ".":
    default:
      return ".";
  }
}

/**
 * Parse `git status --porcelain=v2 --branch`. Lines:
 *   `# branch.head <name>`            current branch (or "(detached)")
 *   `# branch.upstream <name>`        upstream
 *   `# branch.ab +A -B`               ahead/behind
 *   `1 XY ... <path>`                 changed tracked (ordinary)
 *   `2 XY ... <path>\t<origPath>`     renamed/copied (path + orig, tab-NUL... )
 *   `u XY ... <path>`                 unmerged
 *   `? <path>`                        untracked
 *   `! <path>`                        ignored
 */
export function parseStatus(stdout: string): GitStatus {
  let branch = "(detached)";
  let upstream: string | undefined;
  let ahead = 0;
  let behind = 0;
  const entries: GitStatusEntry[] = [];

  // porcelain=v2 with --branch is newline-separated (rename uses a tab inside
  // the line, not NUL, unless -z is given — we don't pass -z here).
  for (const line of stdout.split("\n")) {
    if (!line) continue;
    if (line.startsWith("# branch.head ")) {
      branch = line.slice("# branch.head ".length).trim();
      continue;
    }
    if (line.startsWith("# branch.upstream ")) {
      upstream = line.slice("# branch.upstream ".length).trim();
      continue;
    }
    if (line.startsWith("# branch.ab ")) {
      const m = line.match(/\+(\d+)\s+-(\d+)/);
      if (m) {
        ahead = Number(m[1]);
        behind = Number(m[2]);
      }
      continue;
    }
    if (line.startsWith("# ")) continue;

    const kind = line[0];
    if (kind === "1") {
      // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
      const parts = line.split(" ");
      const xy = parts[1];
      const path = parts.slice(8).join(" ");
      entries.push({
        path,
        staged: toCode(xy[0]),
        unstaged: toCode(xy[1]),
      });
    } else if (kind === "2") {
      // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path>\t<origPath>
      const tab = line.indexOf("\t");
      const head = tab === -1 ? line : line.slice(0, tab);
      const origPath = tab === -1 ? undefined : line.slice(tab + 1);
      const parts = head.split(" ");
      const xy = parts[1];
      const path = parts.slice(9).join(" ");
      entries.push({
        path,
        origPath,
        staged: toCode(xy[0]),
        unstaged: toCode(xy[1]),
      });
    } else if (kind === "u") {
      // u <XY> ... <path>
      const parts = line.split(" ");
      const path = parts.slice(10).join(" ");
      entries.push({ path, staged: "U", unstaged: "U" });
    } else if (kind === "?") {
      entries.push({ path: line.slice(2), staged: ".", unstaged: "?" });
    } else if (kind === "!") {
      entries.push({ path: line.slice(2), staged: ".", unstaged: "!" });
    }
  }

  return {
    branch,
    upstream,
    ahead,
    behind,
    clean: entries.length === 0,
    entries,
  };
}

interface NumstatRow {
  added: number;
  removed: number;
  binary: boolean;
  path: string;
  oldPath: string;
}

/** Parse `git diff --numstat -M` (TAB-separated; `-` for binary). */
function parseNumstat(stdout: string): Map<string, NumstatRow> {
  const map = new Map<string, NumstatRow>();
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const [a, r, ...rest] = line.split("\t");
    const pathField = rest.join("\t");
    const binary = a === "-" || r === "-";
    // Renames render as "old => new" or "{a => b}/c" in numstat; the patch
    // header is authoritative for path, so we key numstat by the new path's
    // tail. Normalize the simple "old => new" arrow form.
    let path = pathField;
    let oldPath = pathField;
    const arrow = pathField.match(/^(.*)\{(.*) => (.*)\}(.*)$/);
    if (arrow) {
      const [, pre, from, to, post] = arrow;
      oldPath = `${pre}${from}${post}`.replace(/\/\//g, "/");
      path = `${pre}${to}${post}`.replace(/\/\//g, "/");
    } else if (pathField.includes(" => ")) {
      const [from, to] = pathField.split(" => ");
      oldPath = from;
      path = to;
    }
    map.set(path, {
      added: binary ? 0 : Number(a),
      removed: binary ? 0 : Number(r),
      binary,
      path,
      oldPath,
    });
  }
  return map;
}

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse a unified-diff patch (`git diff -M`, no color) plus the matching
 * `--numstat` for add/removed counts and binary detection.
 */
export function parseDiff(patch: string, numstat: string): GitFileDiff[] {
  const counts = parseNumstat(numstat);
  const files: GitFileDiff[] = [];
  const lines = patch.split("\n");
  let cur: GitFileDiff | null = null;
  let hunk: GitDiffHunk | null = null;

  const flushHunk = (): void => {
    if (cur && hunk) cur.hunks.push(hunk);
    hunk = null;
  };
  const flushFile = (): void => {
    flushHunk();
    if (cur) files.push(cur);
    cur = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("diff --git ")) {
      flushFile();
      // `diff --git a/<old> b/<new>` — take the b/ side as the path.
      const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      const oldP = m ? m[1] : "";
      const newP = m ? m[2] : "";
      const stat = counts.get(newP);
      cur = {
        path: newP,
        oldPath: oldP,
        status: ".",
        added: stat?.added ?? 0,
        removed: stat?.removed ?? 0,
        binary: stat?.binary ?? false,
        hunks: [],
      };
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("new file mode")) cur.status = "A";
    else if (line.startsWith("deleted file mode")) cur.status = "D";
    else if (line.startsWith("rename from") || line.startsWith("rename to")) cur.status = "R";
    else if (line.startsWith("Binary files")) cur.binary = true;
    else if (line.startsWith("@@")) {
      flushHunk();
      const m = line.match(HUNK_RE);
      if (m) {
        hunk = {
          header: line,
          oldStart: Number(m[1]),
          oldLines: m[2] ? Number(m[2]) : 1,
          newStart: Number(m[3]),
          newLines: m[4] ? Number(m[4]) : 1,
          lines: [],
        };
      }
    } else if (
      hunk &&
      (line.startsWith(" ") || line.startsWith("+") || line.startsWith("-")) &&
      !line.startsWith("+++") &&
      !line.startsWith("---")
    ) {
      hunk.lines.push(line);
    }
  }
  flushFile();

  // Default status for plain modifications.
  for (const f of files) {
    if (f.status === ".") f.status = "M";
  }
  return files;
}

const RS = "\x1e";
const NUL = "\x00";

/** Parse the NUL-field / RS-record `git log` format. */
export function parseLog(stdout: string): GitLogEntry[] {
  const out: GitLogEntry[] = [];
  for (const rec of stdout.split(RS)) {
    const trimmed = rec.replace(/^\n/, "");
    if (!trimmed.trim()) continue;
    const f = trimmed.split(NUL);
    if (f.length < 7) continue;
    const [hash, shortHash, author, authorEmail, date, parents, subject] = f;
    out.push({
      hash,
      shortHash,
      author,
      authorEmail,
      date,
      subject,
      parents: parents.trim() ? parents.trim().split(" ") : [],
    });
  }
  return out;
}

/**
 * Parse `git blame --porcelain`. Each line group starts with
 * `<hash> <origLine> <finalLine> [<numLines>]`, followed by header lines
 * (author, author-mail, author-time, …) and the content line prefixed by TAB.
 * Commit headers are emitted once per commit, then referenced by hash.
 */
export function parsePorcelainBlame(stdout: string): GitBlameLine[] {
  const lines = stdout.split("\n");
  const commitAuthor = new Map<string, string>();
  const commitDate = new Map<string, string>();
  const result: GitBlameLine[] = [];

  let curHash = "";
  let curFinalLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = line.match(/^([0-9a-f]{40}) (\d+) (\d+)(?: (\d+))?$/);
    if (headerMatch) {
      curHash = headerMatch[1];
      curFinalLine = Number(headerMatch[3]);
      continue;
    }
    if (line.startsWith("author ")) {
      commitAuthor.set(curHash, line.slice("author ".length));
      continue;
    }
    if (line.startsWith("author-time ")) {
      commitDate.set(curHash, line.slice("author-time ".length).trim());
      continue;
    }
    if (line.startsWith("\t")) {
      result.push({
        hash: curHash,
        shortHash: curHash.slice(0, 7),
        author: commitAuthor.get(curHash) ?? "",
        date: commitDate.get(curHash) ?? "",
        lineNo: curFinalLine,
        content: line.slice(1),
      });
    }
  }
  return result;
}
