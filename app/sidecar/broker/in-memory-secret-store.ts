/**
 * InMemorySecretStore (B4 Phase 1) — the deterministic-fake secret vault behind
 * the {@link SecretStore} contract. Capability-by-reference (§3.2): callers
 * address a secret by a reference NAME; the value is only ever used inside the
 * `inject` callback, at the execution layer. There is no method that returns a
 * value to a caller.
 *
 * DEFERRED: the real OS keychain (macOS `security`, Windows DPAPI, Linux
 * libsecret) is a thin swap behind this same contract — `put`/`inject`/`list`
 * map onto keychain item add/read/enumerate. The in-memory store is the fake
 * the build hermetically tests against.
 *
 * Security posture (encoded as the type shape, verified by tests):
 *  - `list()` returns reference NAMES only — never values. Safe to log / surface
 *    in the UI / put in the session store.
 *  - `inject(ref, use)` scopes the value to `use`; the value is never returned
 *    out of the store to the caller. "Read the secret into my own variable" is
 *    structurally impossible — there is no `get(ref): string`.
 *  - The internal value map is private and never enumerated by value.
 */

import type { SecretStore } from "@/contracts";

export class InMemorySecretStore implements SecretStore {
  /** ref → value. PRIVATE. Never enumerated by value, never returned by value. */
  readonly #values = new Map<string, string>();

  put(ref: string, value: string): void {
    if (!ref) throw new Error("secret reference name must be non-empty");
    this.#values.set(ref, value);
  }

  list(): string[] {
    // Reference names only — never values.
    return [...this.#values.keys()].sort();
  }

  has(ref: string): boolean {
    return this.#values.has(ref);
  }

  inject<T>(ref: string, use: (value: string) => T): T {
    const value = this.#values.get(ref);
    if (value === undefined) {
      throw new Error(`unknown credential reference "${ref}"`);
    }
    // The value lives only for the duration of `use`. It is never returned to
    // the caller, never assigned to a field, never logged.
    return use(value);
  }
}
