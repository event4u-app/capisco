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

import type { CapabilityBroker, SessionOrigin, SessionStore } from "@/contracts";
import type { ProviderRegistry } from "./registry/registry.ts";
import { InMemorySessionStore } from "./session/in-memory-session-store.ts";
import { LiveModelRouter } from "./model-routing/live-router.ts";
import { TodoProviderImpl } from "./todo/todo-provider.ts";
import { createAcpTodoStarter } from "./todo/acp-todo-starter.ts";
import { createNativeTodoStarter } from "./todo/native-todo-starter.ts";
import type { PermissionResolver } from "./acp/acp-session.ts";
import type { TerseConfig } from "./acp/caveman-terse.ts";
import type { PendingPermissionRegistry } from "./acp/pending-permission-registry.ts";
import {
  readRealAcpEnv,
  resolveRealAcpAdapter,
  type RealAcpConfig,
} from "./acp/real-acp-config.ts";

export const SESSION_PROVIDER_ID = "session";
export const TODO_PROVIDER_ID = "todo";

/**
 * Which agent backend drives a ToDo-triggered run (B8). Both run behind the
 * IDENTICAL session interface (a broker-gated `start` over the persistent store):
 *  - `acp`    — the ACP stdio path (stub by default; the Zed `claude-code-acp`
 *    bridge or another real ACP CLI is a thin transport swap, P2b/P4).
 *  - `native` — the NATIVE `claude` stream-json adapter (P2a, {@link ClaudeCodeProvider}),
 *    driving `claude -p --output-format=stream-json` directly with the existing
 *    Claude login (no raw key).
 * Default is `acp` — the deterministic stub stays the default so the mock/stub
 * fallback and CI never need a real agent.
 */
export type SessionBackend = "acp" | "native";

export interface RegisterSessionOptions {
  /** Reuse an existing store (defaults to a fresh in-memory store). */
  store?: SessionStore;
  /** Human-in-the-loop gate for ToDo-triggered runs (defaults to fail-closed). */
  resolvePermission?: PermissionResolver;
  /**
   * The LIVE pending-permission registry (the UI human-in-the-loop gate). When
   * given, its `resolver` is used for ToDo-triggered runs — an `ask` parks for the
   * UI and awaits a `resolvePermission` IPC decision (the registry fails closed on
   * a bounded timeout / no client). An explicit `resolvePermission` still wins
   * (test override). Without either, the gate defaults to fail-closed deny-all.
   */
  pending?: PendingPermissionRegistry;
  /** Spawn override (tests). Defaults to the stub agent. */
  command?: string;
  args?: string[];
  /**
   * Force the ACP `initialize` handshake (B8 P2b) for the `acp` backend, paired
   * with a test `command`/`args` override pointing at the fake bridge stub. When
   * omitted, the handshake flag comes from the real-adapter/bridge resolution
   * (the stub stays handshake-free by default).
   */
  handshake?: boolean;
  /** Model/agent label override (tests). Defaults to the resolved label or stub. */
  model?: string;
  /**
   * LIVE model-routing (road-to-model-routing P0). When given, a ToDo-triggered
   * run's spawn model is the router's deterministic decision for its origin
   * (`{ kind: "todo" }` — mechanical, routes small when on; never downgraded if
   * blocklisted; default large when the toggle is off). An explicit `model`
   * (test override) still wins. Without a router the pre-routing fixed default is
   * used, so existing wiring is unchanged (routing is opt-in, default off).
   */
  router?: LiveModelRouter;
  /** The origin of a ToDo-triggered run (defaults to `{ kind: "todo" }`). */
  origin?: SessionOrigin;
  /**
   * Which backend drives the ToDo→agent run. Defaults to `acp` (deterministic
   * stub). `native` selects the {@link ClaudeCodeProvider} stream-json adapter.
   * Both enforce the same broker seam, so the choice is purely the transport.
   */
  backend?: SessionBackend;
  /**
   * Real ACP adapter config (P4, key-gated). Defaults to {@link readRealAcpEnv}.
   * When it resolves LIVE (CLI installed + key present) the session spawns the
   * real CLI; otherwise the deterministic stub stays the default. An explicit
   * `command` (test override) always wins over the real-adapter resolution.
   * Only consulted for the `acp` backend.
   */
  realAcp?: RealAcpConfig;
  /**
   * Caveman terse mode (Phase 2). Default ON (opt-out per session). Injected
   * NATIVELY into BOTH backends' system context — the choice of backend never
   * changes whether terse applies. Border surfaces (diagnostics/broker/secret/
   * audit/commit) structurally bypass the injector (AK-T3).
   */
  terse?: TerseConfig;
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
  const backend: SessionBackend = opts.backend ?? "acp";
  // An explicit resolver (test override) wins; otherwise the live pending registry
  // (UI gate) supplies one; otherwise the starters fall back to fail-closed.
  const resolvePermission = opts.resolvePermission ?? opts.pending?.resolver;

  let command = opts.command;
  let args = opts.args;
  let model = opts.model;
  let handshake = opts.handshake ?? false;

  let starter;
  if (backend === "native") {
    // NATIVE Claude-Code backend (P2a): drive `claude` stream-json directly. The
    // `claude` CLI is the default spawn (existing login, no raw key); a test
    // passes a `command`/`args` override pointing at the recorded-fixture
    // replayer. Same broker seam as the ACP path — selectable, not divergent.
    starter = createNativeTodoStarter({
      broker,
      store,
      model,
      router: opts.router,
      origin: opts.origin,
      resolvePermission,
      command,
      args,
      terse: opts.terse,
    });
  } else {
    // P4 — key-gated real ACP adapter. An explicit test `command` override wins.
    // Otherwise resolve the real adapter from config/env: LIVE only when the CLI
    // is installed AND the key is in the vault; dormant (stub) otherwise. The key
    // (if any) is moved into the broker vault inside `resolveRealAcpAdapter` —
    // only the reference name leaves it.
    if (command === undefined) {
      const resolution = resolveRealAcpAdapter(opts.realAcp ?? readRealAcpEnv(), broker);
      if (resolution.spawn) {
        command = resolution.spawn.command;
        args = resolution.spawn.args;
        model = model ?? resolution.spawn.model;
        handshake = resolution.spawn.handshake ?? false;
      }
    }
    starter = createAcpTodoStarter({
      broker,
      store,
      model,
      router: opts.router,
      origin: opts.origin,
      resolvePermission,
      command,
      args,
      handshake,
      terse: opts.terse,
    });
  }
  const todo = new TodoProviderImpl(store, starter);

  registry.register(SESSION_PROVIDER_ID, store as never);
  registry.register(TODO_PROVIDER_ID, todo as never);
  return { store };
}
