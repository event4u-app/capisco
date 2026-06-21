/**
 * Session-Store + ToDo wiring (B3). Registers the persistent session store and
 * the ToDo provider on the sidecar registry, BEHIND the capability broker (B4)
 * — the ToDo "send to agent" path spawns a broker-gated ACP session, so the
 * agent can never act around the chokepoint.
 *
 * Only the serialization-safe surface is RPC-able:
 *  - `session` — the {@link SessionStore} (create/list/get/append/update/
 *    resume/retryAsBranch/copy/search). All JSON-shaped, no secret values.
 *  - `todo` — list + sendToAgent + statusOf.
 *
 * The ACP transport itself (child-process stdio + the secret-bearing
 * execution-layer) is NOT on the wire — it lives in-process at the execution
 * layer, exactly like the broker's `execute` and the runtime stream (B2/B4
 * split). The default human-in-the-loop resolver is fail-closed (deny-all); a
 * real UI swaps in a resolver that prompts the user.
 */

import type { CapabilityBroker, SessionStore } from "@/contracts";
import type { ProviderRegistry } from "./registry/registry.ts";
import { InMemorySessionStore } from "./session/in-memory-session-store.ts";
import { TodoProviderImpl } from "./todo/todo-provider.ts";
import { createAcpTodoStarter } from "./todo/acp-todo-starter.ts";
import type { PermissionResolver } from "./acp/acp-session.ts";
import {
  readRealAcpEnv,
  resolveRealAcpAdapter,
  type RealAcpConfig,
} from "./acp/real-acp-config.ts";

export const SESSION_PROVIDER_ID = "session";
export const TODO_PROVIDER_ID = "todo";

export interface RegisterSessionOptions {
  /** Reuse an existing store (defaults to a fresh in-memory store). */
  store?: SessionStore;
  /** Human-in-the-loop gate for ToDo-triggered runs (defaults to fail-closed). */
  resolvePermission?: PermissionResolver;
  /** Spawn override (tests). Defaults to the stub agent. */
  command?: string;
  args?: string[];
  /** Model/agent label override (tests). Defaults to the resolved label or stub. */
  model?: string;
  /**
   * Real ACP adapter config (P4, key-gated). Defaults to {@link readRealAcpEnv}.
   * When it resolves LIVE (CLI installed + key present) the session spawns the
   * real CLI; otherwise the deterministic stub stays the default. An explicit
   * `command` (test override) always wins over the real-adapter resolution.
   */
  realAcp?: RealAcpConfig;
}

export interface SessionWiring {
  store: SessionStore;
}

/**
 * Register the session store + ToDo provider. The ToDo provider's "send to
 * agent" seam is wired to a broker-gated {@link AcpSession} (the deterministic
 * stub; a real CLI is a thin transport swap).
 */
export function registerSession(
  registry: ProviderRegistry,
  broker: CapabilityBroker,
  opts: RegisterSessionOptions = {},
): SessionWiring {
  const store = opts.store ?? new InMemorySessionStore();

  // P4 — key-gated real ACP adapter. An explicit test `command` override wins.
  // Otherwise resolve the real adapter from config/env: LIVE only when the CLI
  // is installed AND the key is in the vault; dormant (stub) otherwise. The key
  // (if any) is moved into the broker vault inside `resolveRealAcpAdapter` — only
  // the reference name leaves it.
  let command = opts.command;
  let args = opts.args;
  let model = opts.model;
  if (command === undefined) {
    const resolution = resolveRealAcpAdapter(opts.realAcp ?? readRealAcpEnv(), broker);
    if (resolution.spawn) {
      command = resolution.spawn.command;
      args = resolution.spawn.args;
      model = model ?? resolution.spawn.model;
    }
  }

  const starter = createAcpTodoStarter({
    broker,
    store,
    model,
    resolvePermission: opts.resolvePermission,
    command,
    args,
  });
  const todo = new TodoProviderImpl(store, starter);

  registry.register(SESSION_PROVIDER_ID, store as never);
  registry.register(TODO_PROVIDER_ID, todo as never);
  return { store };
}
