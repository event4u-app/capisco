/**
 * IPC-backed {@link TerminalProvider} (road-to-actually-works P6) — the real
 * shell-PTY surface over the sidecar bridge. Reads/commands (open/write/resize/
 * close/list) are plain `call`s; `subscribe` opens an IPC stream on channel
 * `terminal:<id>`.
 *
 * Mirrors the agent proxy: the contract's `subscribe` returns a synchronous
 * `Unsubscribe`, while the IPC subscribe is async (it round-trips a server-side
 * subscription id), so the proxy kicks the async open in the background and hands
 * back an unsubscribe that works immediately and also tears the server stream
 * down once it has opened.
 */

import type {
  TerminalEvent,
  TerminalInfo,
  TerminalOpenSpec,
  TerminalProvider,
  Unsubscribe,
} from "@/contracts";
import type { SidecarClient } from "./sidecar-client.ts";

const ID = "terminal";

export function createTerminalProxy(client: SidecarClient): TerminalProvider {
  const call = <R>(method: string, args: unknown[] = []): Promise<R> =>
    client.call<R>(ID, method, args);

  return {
    open: (spec: TerminalOpenSpec) => call<TerminalInfo>("open", [spec]),
    write: (id, data) => call<void>("write", [id, data]),
    resize: (id, cols, rows) => call<void>("resize", [id, cols, rows]),
    close: (id) => call<void>("close", [id]),
    list: () => call<TerminalInfo[]>("list"),
    subscribe(id: string, listener: (event: TerminalEvent) => void): Unsubscribe {
      let teardown: (() => void) | null = null;
      let cancelled = false;
      void client
        .subscribe(ID, id, (event) => listener(event as TerminalEvent))
        .then((off) => {
          if (cancelled) off();
          else teardown = off;
        })
        .catch(() => {
          /* stream failed to open — nothing to tear down */
        });
      return () => {
        cancelled = true;
        if (teardown) teardown();
      };
    },
  };
}
