/**
 * KeychainSecretStore (road-to-real-breadth P0) — the real OS-keychain swap for
 * InMemorySecretStore, behind the identical synchronous {@link SecretStore}
 * contract.
 *
 * The contract is sync; the keychain is async. Bridge: an in-memory cache that is
 * loaded ONCE from the keychain at sidecar start (`load()`), serves sync
 * put/list/has/inject, and write-through-persists on `put`. Restart-survival +
 * OS-encrypted-at-rest storage, without changing the contract. (In-memory caching
 * matches InMemorySecretStore — the security guarantee is "no value getter", not
 * "no value in process memory".)
 *
 * No garbage (the user's explicit ask): ALL items live under ONE service
 * (`capisco`); `keychainPut` uses `-U` (update-or-add) so re-storing a ref never
 * duplicates; a single `__capisco_index__` item records the ref names so `load()`
 * restores exactly our set and `clear()` removes exactly our set — nothing else
 * in the user's keychain is touched.
 */

import type { SecretStore } from "@/contracts";
import { keychainDelete, keychainGet, keychainPut } from "./keychain-exec.ts";

const INDEX_ACCOUNT = "__capisco_index__";

export class KeychainSecretStore implements SecretStore {
  readonly #cache = new Map<string, string>();
  readonly #service: string;
  /** Serializes write-through so concurrent `security` calls never race. */
  #queue: Promise<void> = Promise.resolve();

  constructor(service = "capisco") {
    this.#service = service;
  }

  /** Load our refs (named in the index) from the keychain into the cache. Call once at boot. */
  async load(): Promise<void> {
    const idx = await keychainGet(this.#service, INDEX_ACCOUNT);
    let names: string[] = [];
    if (idx) {
      try {
        const parsed: unknown = JSON.parse(idx);
        if (Array.isArray(parsed)) names = parsed.filter((n): n is string => typeof n === "string");
      } catch {
        /* corrupt index → start clean; we rewrite it on next put */
      }
    }
    for (const name of names) {
      const value = await keychainGet(this.#service, name);
      if (value !== undefined) this.#cache.set(name, value);
    }
  }

  put(ref: string, value: string): void {
    if (!ref) throw new Error("secret reference name must be non-empty");
    if (ref === INDEX_ACCOUNT) throw new Error(`"${INDEX_ACCOUNT}" is reserved`);
    this.#cache.set(ref, value);
    this.#enqueue(async () => {
      await keychainPut(this.#service, ref, value);
      await this.#writeIndex();
    });
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

  /** Remove one ref from cache + keychain (hygiene, no garbage). */
  delete(ref: string): void {
    this.#cache.delete(ref);
    this.#enqueue(async () => {
      await keychainDelete(this.#service, ref);
      await this.#writeIndex();
    });
  }

  /** Remove ALL our items + the index (full cleanup). */
  clear(): void {
    const names = [...this.#cache.keys()];
    this.#cache.clear();
    this.#enqueue(async () => {
      for (const n of names) await keychainDelete(this.#service, n);
      await keychainDelete(this.#service, INDEX_ACCOUNT);
    });
  }

  /** Await all pending write-throughs (tests / graceful shutdown). */
  flush(): Promise<void> {
    return this.#queue;
  }

  #writeIndex(): Promise<void> {
    return keychainPut(this.#service, INDEX_ACCOUNT, JSON.stringify([...this.#cache.keys()]));
  }

  #enqueue(fn: () => Promise<void>): void {
    this.#queue = this.#queue.then(fn).catch(() => {
      /* keep the chain alive; a failed persist leaves the cache authoritative */
    });
  }
}
