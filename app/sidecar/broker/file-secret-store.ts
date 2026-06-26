/**
 * FileSecretStore (road-to-real-breadth P0) — the non-macOS / keychain-unavailable
 * fallback behind the {@link SecretStore} contract. ONE 0600 JSON file (no argv
 * exposure, unlike the keychain `security -w` write), survives restart.
 *
 * No garbage: a single file at a fixed path; `put` is idempotent (replace by ref);
 * `clear()` removes the file. Plaintext at rest, 0600 (owner-only) — weaker than
 * the OS keychain, which is why this is the FALLBACK, not the default.
 */

import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { SecretStore } from "@/contracts";

export class FileSecretStore implements SecretStore {
  readonly #cache = new Map<string, string>();
  readonly #path: string;

  constructor(path: string) {
    this.#path = path;
    this.#load();
  }

  #load(): void {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.#path, "utf8"));
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === "string") this.#cache.set(k, v);
        }
      }
    } catch {
      /* missing/corrupt → start empty; next put rewrites the file */
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#path), { recursive: true });
    const obj: Record<string, string> = {};
    for (const [k, v] of this.#cache) obj[k] = v;
    writeFileSync(this.#path, JSON.stringify(obj), { mode: 0o600 });
    chmodSync(this.#path, 0o600); // enforce even if the file pre-existed with looser perms
  }

  put(ref: string, value: string): void {
    if (!ref) throw new Error("secret reference name must be non-empty");
    this.#cache.set(ref, value);
    this.#persist();
  }

  list(): string[] {
    return [...this.#cache.keys()].sort();
  }

  has(ref: string): boolean {
    return this.#cache.has(ref);
  }

  inject<T>(ref: string, use: (value: string) => T): T {
    const value = this.#cache.get(ref);
    if (value === undefined) throw new Error(`unknown credential reference "${ref}"`);
    return use(value);
  }

  delete(ref: string): void {
    if (this.#cache.delete(ref)) this.#persist();
  }

  clear(): void {
    this.#cache.clear();
    try {
      rmSync(this.#path, { force: true });
    } catch {
      /* already gone */
    }
  }
}
