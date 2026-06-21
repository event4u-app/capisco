/**
 * Provider registry (B0, concept §2.3 — "der Stecker").
 *
 * The sidecar core is thin: a registry plus the IPC server. Every capability —
 * even the first-party ones — is a provider registered under a stable id. The
 * registry turns the in-process provider objects (the same `contracts/`
 * interfaces the UI mocks implement) into a flat JSON-RPC method surface:
 *
 *     "<providerId>.<method>"   e.g.  "agent.listSessions", "workspace.getDiff"
 *
 * A request's `params` is the positional argument array of the provider method.
 * The dispatcher looks the provider up, validates the method exists, and calls
 * it — awaiting any promise. Streaming (`agent.subscribe`) is handled out of
 * band by the IPC server, not here: the registry is a pure method router.
 */

export type ProviderMethods = Record<string, (...args: never[]) => unknown>;

export interface RegistryEntry {
  id: string;
  provider: ProviderMethods;
}

export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderMethods>();

  /** Register a provider under a stable id. Re-registering an id throws. */
  register(id: string, provider: ProviderMethods): void {
    if (this.providers.has(id)) {
      throw new Error(`Provider id "${id}" is already registered`);
    }
    this.providers.set(id, provider);
  }

  /**
   * Register a provider, replacing any existing entry under the id. Used by the
   * dev bridge to swap the mock workspace for the real git/fs providers behind
   * the same wire id once a repo is opened — same contract, same method surface.
   */
  replace(id: string, provider: ProviderMethods): void {
    this.providers.set(id, provider);
  }

  has(id: string): boolean {
    return this.providers.has(id);
  }

  get(id: string): ProviderMethods | undefined {
    return this.providers.get(id);
  }

  list(): string[] {
    return [...this.providers.keys()].sort();
  }

  /**
   * Dispatch a `"<providerId>.<method>"` call with a positional-args array.
   * Throws a descriptive error for an unknown provider / method / shape — the
   * RPC server maps the throw to a JSON-RPC error response.
   */
  async dispatch(qualified: string, args: unknown[]): Promise<unknown> {
    const dot = qualified.indexOf(".");
    if (dot === -1) {
      throw new Error(`Malformed method "${qualified}" (expected "provider.method")`);
    }
    const providerId = qualified.slice(0, dot);
    const method = qualified.slice(dot + 1);
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Unknown provider "${providerId}"`);
    }
    const fn = provider[method];
    if (typeof fn !== "function") {
      throw new Error(`Provider "${providerId}" has no method "${method}"`);
    }
    return await (fn as (...a: unknown[]) => unknown).apply(provider, args);
  }
}
