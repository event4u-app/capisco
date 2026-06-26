/**
 * Secret-store tests (road-to-real-breadth P0).
 *  - KeychainSecretStore against the REAL macOS keychain, under a UNIQUE
 *    throwaway service so it never touches the real `capisco` namespace, and
 *    cleaned up in afterEach → the test itself leaves NO garbage.
 *  - FileSecretStore against a temp 0600 file.
 * Both prove: persist + restart-survival (reload restores), idempotent put (no
 * duplicates), inject-only value access, delete/clear hygiene.
 */

import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { keychainAvailable, keychainDelete } from "../broker/keychain-exec.ts";
import { KeychainSecretStore } from "../broker/keychain-secret-store.ts";
import { FileSecretStore } from "../broker/file-secret-store.ts";

const kcAvailable = await keychainAvailable();
const kcRun = kcAvailable ? it : it.skip;

// Unique throwaway service so we never collide with the real "capisco" namespace.
const TEST_SERVICE = `capisco-test-${process.pid}-${Date.now()}`;

describe("KeychainSecretStore ↔ real macOS keychain", () => {
  afterEach(async () => {
    // Belt-and-suspenders cleanup: remove our throwaway items so no garbage remains.
    const store = new KeychainSecretStore(TEST_SERVICE);
    await store.load();
    store.clear();
    await store.flush();
    await keychainDelete(TEST_SERVICE, "__capisco_index__");
  });

  kcRun("persists, survives a reload, injects (no value getter), idempotent put", async () => {
    const store = new KeychainSecretStore(TEST_SERVICE);
    await store.load();

    store.put("staging-admin", "s3cr3t-token-A");
    store.put("github-pat", "ghp_xyz");
    await store.flush();

    expect(store.list()).toEqual(["github-pat", "staging-admin"]);
    expect(store.has("staging-admin")).toBe(true);
    expect(store.inject("staging-admin", (v) => v.toUpperCase())).toBe("S3CR3T-TOKEN-A");

    // Idempotent: re-put the same ref must NOT create a duplicate.
    store.put("staging-admin", "s3cr3t-token-A2");
    await store.flush();
    expect(store.list().filter((n) => n === "staging-admin")).toHaveLength(1);

    // Restart-survival: a FRESH store instance loads the same secrets from the keychain.
    const reborn = new KeychainSecretStore(TEST_SERVICE);
    await reborn.load();
    expect(reborn.list()).toEqual(["github-pat", "staging-admin"]);
    expect(reborn.inject("staging-admin", (v) => v)).toBe("s3cr3t-token-A2"); // updated value survived
  });

  kcRun("delete + clear remove exactly our items (no garbage)", async () => {
    const store = new KeychainSecretStore(TEST_SERVICE);
    await store.load();
    store.put("a", "1");
    store.put("b", "2");
    await store.flush();
    store.delete("a");
    await store.flush();
    expect(store.list()).toEqual(["b"]);

    const reborn = new KeychainSecretStore(TEST_SERVICE);
    await reborn.load();
    expect(reborn.list()).toEqual(["b"]); // delete persisted

    store.clear();
    await store.flush();
    const empty = new KeychainSecretStore(TEST_SERVICE);
    await empty.load();
    expect(empty.list()).toEqual([]); // nothing left behind
  });
});

describe("FileSecretStore (0600 fallback)", () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "capisco-secret-"));
    path = join(dir, "secrets.json");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("persists, survives reload, injects, writes 0600", () => {
    const store = new FileSecretStore(path);
    store.put("token", "abc");
    expect(store.list()).toEqual(["token"]);
    expect(store.inject("token", (v) => v)).toBe("abc");

    // 0600 perms (owner read/write only).
    expect(statSync(path).mode & 0o777).toBe(0o600);

    // Restart-survival.
    const reborn = new FileSecretStore(path);
    expect(reborn.has("token")).toBe(true);
    expect(reborn.inject("token", (v) => v)).toBe("abc");
  });

  it("idempotent put (replace, no duplicate) + clear removes the file", () => {
    const store = new FileSecretStore(path);
    store.put("k", "v1");
    store.put("k", "v2");
    expect(store.list()).toEqual(["k"]);
    expect(store.inject("k", (v) => v)).toBe("v2");
    store.clear();
    expect(new FileSecretStore(path).list()).toEqual([]);
  });

  it("inject throws on an unknown ref (no silent value leak)", () => {
    const store = new FileSecretStore(path);
    expect(() => store.inject("nope", (v) => v)).toThrow(/unknown credential/i);
  });
});
