/**
 * ACP-backed {@link TodoSessionStarter} (B3 Phase 2). Wires the ToDo provider's
 * "send to agent" seam to a real broker-gated {@link AcpSession} running the
 * deterministic stub agent in the given worktree. Swapping the stub for a real
 * ACP CLI is a transport swap inside {@link AcpSession} — this starter is
 * unchanged.
 *
 * The returned session id is the persistent store session, so the ToDo stays
 * linked to a resumable, searchable, branchable run (§2.2).
 */

import type { CapabilityBroker, SessionOrigin, SessionStore } from "@/contracts";
import { AcpSession, type PermissionResolver } from "../acp/acp-session.ts";
import type { TerseConfig } from "../acp/caveman-terse.ts";
import type { LiveModelRouter } from "../model-routing/live-router.ts";
import type { TodoSessionStarter } from "./todo-provider.ts";

export interface AcpTodoStarterOptions {
  broker: CapabilityBroker;
  store: SessionStore;
  model?: string;
  /**
   * LIVE origin-routing (road-to-model-routing P0). When given, the spawned
   * session's model is the router's decision for `origin` — deterministic, by
   * origin, honouring the on/off toggle AND the blocklist invariant. A ToDo run
   * is origin `{ kind: "todo" }` (mechanical → routes small when on). An explicit
   * `model` (test override) still wins. Without a router the fixed model is used
   * (the pre-routing default).
   */
  router?: LiveModelRouter;
  /** The origin of the spawned session (defaults to `{ kind: "todo" }`). */
  origin?: SessionOrigin;
  /**
   * The human-in-the-loop gate (the ONLY thing that clears an `ask`, including a
   * lethal-trifecta egress). Defaults to deny-all (fail closed) — a real UI
   * passes a resolver that prompts the user.
   */
  resolvePermission?: PermissionResolver;
  /** Spawn override (tests). Defaults to the stub agent. */
  command?: string;
  args?: string[];
  /**
   * Run the ACP `initialize` handshake before session/new (B8 P2b). The real
   * `claude-code-acp` bridge requires it; the stub does not. Defaults to `false`.
   */
  handshake?: boolean;
  /** Side-effect performer for an allowed action (defaults to no-op). */
  perform?: AcpSessionOptionsPerform;
  /** Caveman terse config (Phase 2; default ON, opt-out per session). */
  terse?: TerseConfig;
}

type AcpSessionOptionsPerform = ConstructorParameters<typeof AcpSession>[0]["perform"];

export function createAcpTodoStarter(opts: AcpTodoStarterOptions): TodoSessionStarter {
  // Origin-routed spawn model: an explicit `model` (test override) wins; else the
  // router's deterministic decision for the origin (default `{ kind: "todo" }`);
  // else the pre-routing fixed default. Resolved once at construction — the
  // origin of this starter is fixed, so the model is too (deterministic).
  const origin: SessionOrigin = opts.origin ?? { kind: "todo" };
  const routedModel = opts.model ?? opts.router?.resolveSpawn(origin).model ?? "Stub Agent";
  return async (prompt: string, worktreePath: string): Promise<string> => {
    const session = new AcpSession({
      broker: opts.broker,
      store: opts.store,
      cwd: worktreePath,
      model: routedModel,
      resolvePermission: opts.resolvePermission,
      command: opts.command,
      args: opts.args,
      handshake: opts.handshake,
      perform: opts.perform,
      terse: opts.terse,
    });
    try {
      return await session.start(prompt);
    } finally {
      session.close();
    }
  };
}
