#!/usr/bin/env node
/**
 * capisco secret CLI (road-to-real-breadth P0) — save tokens into the SAME
 * keychain namespace the dev sidecar reads (`capisco` service + the
 * `__capisco_index__` index), so a token you store here is loaded by
 * KeychainSecretStore on the next `task dev:web`.
 *
 * No leak, no garbage:
 *  - `put <ref>` reads the VALUE from STDIN (never argv → never in shell history).
 *    Cleanest: copy the token, then  `pbpaste | node scripts/secret.mjs put jira-token`
 *  - one `capisco` service, `-U` (update-or-add) → re-storing a ref never dups.
 *  - `list` prints reference NAMES only, never values (safe to paste back to me).
 *
 * Usage:
 *   pbpaste | node scripts/secret.mjs put <ref>     # macOS: token from clipboard
 *   node scripts/secret.mjs put <ref> < tokenfile   # or from a file (then rm it)
 *   node scripts/secret.mjs list
 *   node scripts/secret.mjs delete <ref>
 *   node scripts/secret.mjs clear
 *
 * Falls back to the 0600 file (~/.event4u/agent-config/capisco-secrets.json) when
 * the macOS keychain is unavailable — same file the FileSecretStore uses.
 */

import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

const SERVICE = "capisco";
const INDEX = "__capisco_index__";
const FILE = join(homedir(), ".event4u", "agent-config", "capisco-secrets.json");

function hasKeychain() {
  if (platform() !== "darwin") return false;
  try {
    execFileSync("security", ["help"], { stdio: "ignore" });
    return true;
  } catch (e) {
    // `security help` exits non-zero but proves presence; ENOENT = missing.
    return e?.code !== "ENOENT";
  }
}

const kc = {
  get(account) {
    try {
      // stderr→ignore: a missing item is expected (first put has no index yet).
      return execFileSync("security", ["find-generic-password", "-s", SERVICE, "-a", account, "-w"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).replace(/\n$/, "");
    } catch {
      return undefined;
    }
  },
  put(account, value) {
    execFileSync("security", ["add-generic-password", "-U", "-s", SERVICE, "-a", account, "-w", value]);
  },
  del(account) {
    try {
      execFileSync("security", ["delete-generic-password", "-s", SERVICE, "-a", account], { stdio: "ignore" });
    } catch {
      /* missing is fine */
    }
  },
  names() {
    const idx = this.get(INDEX);
    if (!idx) return [];
    try {
      const a = JSON.parse(idx);
      return Array.isArray(a) ? a.filter((n) => typeof n === "string") : [];
    } catch {
      return [];
    }
  },
  writeNames(names) {
    this.put(INDEX, JSON.stringify(names));
  },
};

const file = {
  read() {
    try {
      return JSON.parse(readFileSync(FILE, "utf8"));
    } catch {
      return {};
    }
  },
  write(obj) {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(obj), { mode: 0o600 });
    chmodSync(FILE, 0o600);
  },
};

function readStdin() {
  try {
    return readFileSync(0, "utf8").replace(/\n$/, "");
  } catch {
    return "";
  }
}

const useKc = hasKeychain();
const backend = useKc ? "macOS keychain (service: capisco)" : `file ${FILE} (0600)`;
const [cmd, ref] = process.argv.slice(2);

function listNames() {
  return useKc ? kc.names().sort() : Object.keys(file.read()).sort();
}

switch (cmd) {
  case "put": {
    if (!ref) fail("usage: put <ref>   (value is read from STDIN — e.g. `pbpaste | … put <ref>`)");
    if (ref === INDEX) fail(`"${INDEX}" is reserved`);
    const value = readStdin();
    if (!value) fail("no value on STDIN — pipe the token in, e.g. `pbpaste | node scripts/secret.mjs put <ref>`");
    if (useKc) {
      kc.put(ref, value);
      const names = new Set(kc.names());
      names.add(ref);
      kc.writeNames([...names]);
    } else {
      const obj = file.read();
      obj[ref] = value;
      file.write(obj);
    }
    console.log(`✅ stored "${ref}" in ${backend}. Refs now: ${listNames().join(", ")}`);
    break;
  }
  case "list":
    console.log(`backend: ${backend}`);
    console.log(`refs (names only, no values): ${listNames().join(", ") || "(none)"}`);
    break;
  case "delete": {
    if (!ref) fail("usage: delete <ref>");
    if (useKc) {
      kc.del(ref);
      kc.writeNames(kc.names().filter((n) => n !== ref));
    } else {
      const obj = file.read();
      delete obj[ref];
      file.write(obj);
    }
    console.log(`🗑️  deleted "${ref}". Refs now: ${listNames().join(", ") || "(none)"}`);
    break;
  }
  case "clear": {
    if (useKc) {
      for (const n of kc.names()) kc.del(n);
      kc.del(INDEX);
    } else {
      try {
        rmSync(FILE, { force: true });
      } catch {
        /* gone */
      }
    }
    console.log(`🧹 cleared all capisco secrets from ${backend}.`);
    break;
  }
  default:
    fail("usage: secret <put|list|delete|clear> [ref]   (put/delete take a ref; put reads value from STDIN)");
}

function fail(msg) {
  console.error(`secret: ${msg}`);
  process.exit(1);
}
