/**
 * Native-Claude-Code {@link TodoSessionStarter} (B8 Phase 2a). The native sibling
 * of {@link createAcpTodoStarter}: wires the ToDo "send to agent" seam to a
 * broker-gated {@link ClaudeCodeProvider} driving the `claude` CLI in stream-json
 * mode, in the given worktree.
 *
 * Same contract as the ACP starter — returns the persistent store session id, so
 * the ToDo stays linked to a resumable/searchable/branchable run. The ONLY
 * difference from the ACP starter is the driver class (stream-json transport
 * instead of ACP stdio); both enforce the identical broker seam, so the backend
 * is selectable behind one interface. No raw key (existing `claude` login).
 */

import type { CapabilityBroker, SessionStore } from "@/contracts";
import {
  ClaudeCodeProvider,
  type PermissionResolver,
} from "../acp/claude-code-provider.ts";
import type { TodoSessionStarter } from "./todo-provider.ts";

type NativePerform = ConstructorParameters<typeof ClaudeCodeProvider>[0]["perform"];

export interface NativeTodoStarterOptions {
  broker: CapabilityBroker;
  store: SessionStore;
  model?: string;
  /** Human-in-the-loop gate (defaults to deny-all, fail closed). */
  resolvePermission?: PermissionResolver;
  /** Spawn override (tests). Defaults to the `claude` CLI. */
  command?: string;
  args?: string[];
  /** Side-effect performer for an allowed tool (defaults to no-op). */
  perform?: NativePerform;
}

export function createNativeTodoStarter(opts: NativeTodoStarterOptions): TodoSessionStarter {
  return async (prompt: string, worktreePath: string): Promise<string> => {
    const provider = new ClaudeCodeProvider({
      broker: opts.broker,
      store: opts.store,
      cwd: worktreePath,
      model: opts.model ?? "Claude Code (native)",
      resolvePermission: opts.resolvePermission,
      command: opts.command,
      args: opts.args,
      perform: opts.perform,
    });
    try {
      return await provider.start(prompt);
    } finally {
      provider.close();
    }
  };
}
