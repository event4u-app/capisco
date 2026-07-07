/**
 * Write-only credential provider (road-to-shell-and-chat-really-work P1 — "Save
 * persists the API token"). The settings gear stores the Anthropic token here;
 * it is persisted by the broker's {@link SecretStore} (keychain on macOS, else a
 * 0600 file) so it survives a restart.
 *
 * There is NO read path by design — mirroring the SecretStore invariant. A stored
 * token is used only via the broker's execution-layer injection when a real
 * request runs; it is never handed back to the UI. The provider exposes exactly
 * `put` (store/replace) and `has` (presence, never the value), so "read the token
 * into a variable I control" stays unconstructable across the wire too.
 */

import type { CredentialsProvider, SecretStore } from "@/contracts";

export function createCredentialsProvider(secrets: SecretStore): CredentialsProvider {
  return {
    put: (ref: string, value: string) => {
      secrets.put(ref, value);
      return Promise.resolve();
    },
    has: (ref: string) => Promise.resolve(secrets.has(ref)),
  };
}
