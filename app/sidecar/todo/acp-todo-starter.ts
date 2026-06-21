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

import type { CapabilityBroker, SessionStore } from "@/contracts";
import { AcpSession, type PermissionResolver } from "../acp/acp-session.ts";
import type { TodoSessionStarter } from "./todo-provider.ts";

export interface AcpTodoStarterOptions {
  broker: CapabilityBroker;
  store: SessionStore;
  model?: string;
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
}

type AcpSessionOptionsPerform = ConstructorParameters<typeof AcpSession>[0]["perform"];

export function createAcpTodoStarter(opts: AcpTodoStarterOptions): TodoSessionStarter {
  return async (prompt: string, worktreePath: string): Promise<string> => {
    const session = new AcpSession({
      broker: opts.broker,
      store: opts.store,
      cwd: worktreePath,
      model: opts.model ?? "Stub Agent",
      resolvePermission: opts.resolvePermission,
      command: opts.command,
      args: opts.args,
      handshake: opts.handshake,
      perform: opts.perform,
    });
    try {
      return await session.start(prompt);
    } finally {
      session.close();
    }
  };
}
