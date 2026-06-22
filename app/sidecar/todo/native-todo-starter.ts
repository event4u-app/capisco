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

import type { CapabilityBroker, SessionOrigin, SessionStore } from "@/contracts";
import {
  ClaudeCodeProvider,
  type PermissionResolver,
} from "../acp/claude-code-provider.ts";
import type { TerseConfig } from "../acp/caveman-terse.ts";
import type { LiveModelRouter } from "../model-routing/live-router.ts";
import type { TodoSessionStarter } from "./todo-provider.ts";

type NativePerform = ConstructorParameters<typeof ClaudeCodeProvider>[0]["perform"];

export interface NativeTodoStarterOptions {
  broker: CapabilityBroker;
  store: SessionStore;
  model?: string;
  /**
   * LIVE origin-routing (road-to-model-routing P0) — identical seam to the ACP
   * starter. When given, the spawned model is the router's deterministic
   * decision for `origin` (toggle + blocklist honoured). Explicit `model` wins.
   */
  router?: LiveModelRouter;
  /** The origin of the spawned session (defaults to `{ kind: "todo" }`). */
  origin?: SessionOrigin;
  /** Human-in-the-loop gate (defaults to deny-all, fail closed). */
  resolvePermission?: PermissionResolver;
  /** Spawn override (tests). Defaults to the `claude` CLI. */
  command?: string;
  args?: string[];
  /** Side-effect performer for an allowed tool (defaults to no-op). */
  perform?: NativePerform;
  /** Caveman terse config (Phase 2; default ON, opt-out per session). */
  terse?: TerseConfig;
}

export function createNativeTodoStarter(opts: NativeTodoStarterOptions): TodoSessionStarter {
  const origin: SessionOrigin = opts.origin ?? { kind: "todo" };
  const routedModel =
    opts.model ?? opts.router?.resolveSpawn(origin).model ?? "Claude Code (native)";
  return async (prompt: string, worktreePath: string): Promise<string> => {
    const provider = new ClaudeCodeProvider({
      broker: opts.broker,
      store: opts.store,
      cwd: worktreePath,
      model: routedModel,
      resolvePermission: opts.resolvePermission,
      command: opts.command,
      args: opts.args,
      perform: opts.perform,
      terse: opts.terse,
    });
    try {
      return await provider.start(prompt);
    } finally {
      provider.close();
    }
  };
}
