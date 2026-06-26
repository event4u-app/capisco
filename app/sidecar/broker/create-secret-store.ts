/**
 * Secret-store factory (road-to-real-breadth P0). Picks the strongest available
 * persistent {@link SecretStore} for the host, so secrets survive a restart and
 * the dev instance uses the same store the tests prove:
 *
 *   macOS keychain (encrypted at rest)  →  KeychainSecretStore
 *   otherwise (Linux/Windows/no security) →  FileSecretStore (0600)
 *
 * Tests inject InMemorySecretStore directly (hermetic). One service / one file —
 * no proliferation of keys (the user's "no garbage" requirement).
 */

import { homedir } from "node:os";
import { join } from "node:path";

import type { SecretStore } from "@/contracts";
import { FileSecretStore } from "./file-secret-store.ts";
import { KeychainSecretStore } from "./keychain-secret-store.ts";
import { keychainAvailable } from "./keychain-exec.ts";

export interface CreateSecretStoreOptions {
  /** Keychain service namespace (default "capisco"). Override for isolation/tests. */
  service?: string;
  /** File-fallback path (default ~/.event4u/agent-config/capisco-secrets.json). */
  filePath?: string;
  /** Force the file store even on macOS (tests / opt-out of keychain). */
  preferFile?: boolean;
}

export function defaultSecretFilePath(): string {
  return join(homedir(), ".event4u", "agent-config", "capisco-secrets.json");
}

/** Build + load the best persistent secret store for this host. */
export async function createSecretStore(opts: CreateSecretStoreOptions = {}): Promise<SecretStore> {
  if (!opts.preferFile && (await keychainAvailable())) {
    const store = new KeychainSecretStore(opts.service ?? "capisco");
    await store.load();
    return store;
  }
  return new FileSecretStore(opts.filePath ?? defaultSecretFilePath());
}
