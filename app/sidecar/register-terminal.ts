/**
 * Register the `terminal` provider (road-to-actually-works P6) — a real shell
 * PTY per tab over the IPC wire, backed by {@link PtyHost}. Each open spawns a
 * login shell through the P1 supervisor (node-pty backend); output + exit stream
 * to the consumer via `subscribe`; keystrokes and resize forward back.
 */

import type { ProviderRegistry } from "./registry/registry.ts";
import { PtyHost } from "./runtime/pty-host.ts";
import type { TerminalEvent, TerminalOpenSpec } from "@/contracts";

export const TERMINAL_PROVIDER_ID = "terminal";

export function registerTerminal(registry: ProviderRegistry): PtyHost {
  const host = new PtyHost();
  registry.register(TERMINAL_PROVIDER_ID, {
    open: (spec: TerminalOpenSpec) => host.open(spec),
    write: (id: string, data: string) => host.write(id, data),
    resize: (id: string, cols: number, rows: number) => host.resize(id, cols, rows),
    close: (id: string) => host.close(id),
    list: () => host.list(),
    subscribe: (listener: (event: TerminalEvent) => void) => host.subscribe(listener),
  } as never);
  return host;
}
