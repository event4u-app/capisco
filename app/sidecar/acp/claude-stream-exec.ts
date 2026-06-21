/**
 * Claude-Code stream-json transport primitive (B8 Phase 2a) — a SEALED child
 * process speaking the SDK stream-json protocol over stdin/stdout.
 *
 * This is the NATIVE-backend analog of `acp-transport.ts`: it spawns the `claude`
 * CLI in `--output-format=stream-json --input-format=stream-json --verbose` mode,
 * writes the user prompt as a stream-json `user` envelope on stdin, and surfaces
 * each stdout line (one JSON envelope) to a callback. It does NOT translate or
 * gate anything — the pure parser (`stream-json-parse.ts`) maps envelopes to
 * SessionEvents, and the driver (`claude-code-provider.ts`) owns the broker seam.
 *
 * SECURITY (same posture as the ACP transport, the Re-Audit checklist applies):
 *  - SEALED SUBPROCESS (Red-team Fix 2): stderr is `pipe` (captured to a buffer,
 *    NEVER `inherit`-ed to the host tty), and the env is the EXPLICIT minimal
 *    credential-free allowlist (`sealedChildEnv()` — no `process.env` spread). No
 *    key reaches the child env/argv: the NATIVE Claude path uses the EXISTING
 *    `claude` login (the CLI reads its own auth from its own config/keychain), so
 *    no raw key is introduced here at all.
 *  - The child has NO direct fs/shell/net capability granted by US — its only
 *    consequential actions are the `tool_use` blocks it emits, every one of which
 *    the driver routes through the broker. (The `claude` CLI can act on its own;
 *    in this adapter we run it WITHOUT `--permission-mode bypassPermissions`, and
 *    the broker gate is the client-side authority. A real always-allowed run is
 *    the user's broker-approved go — deferred.)
 *
 * VERIFICATION: a real `claude` invocation is the user's broker-approved go and is
 * never run in tests. The provider test points `command`/`args` at a deterministic
 * recorded-fixture replayer (`node stream-json-fixture-agent.mjs`) that emits the
 * committed stream-json fixture over the same stdout protocol — so the full spine
 * is exercised without a paid model call.
 */

import { spawn, type ChildProcessByStdio } from "node:child_process";
import { existsSync } from "node:fs";
import type { Readable, Writable } from "node:stream";
import { NdjsonDecoder } from "@/lib/sidecar/protocol/ndjson.ts";
import { sealedChildEnv } from "./acp-transport.ts";
import type { StreamJsonEnvelope } from "./stream-json-parse.ts";

/** The default native CLI invocation: `claude` in stream-json bidirectional mode. */
export const CLAUDE_NATIVE_COMMAND = "claude";
export const CLAUDE_NATIVE_ARGS = [
  "-p",
  "--output-format=stream-json",
  "--input-format=stream-json",
  "--verbose",
] as const;

export interface ClaudeStreamTransportOptions {
  /** Command to spawn. Defaults to {@link CLAUDE_NATIVE_COMMAND} (`claude`). */
  command?: string;
  /** Args. Defaults to {@link CLAUDE_NATIVE_ARGS}. */
  args?: string[];
  /** Working directory the run acts in (the worktree). */
  cwd?: string;
  /** Called with each decoded stdout envelope (one JSON object per line). */
  onEnvelope: (env: StreamJsonEnvelope) => void;
  /** Called once when the child process closes (stream ended). */
  onClose: () => void;
}

/**
 * A sealed stream-json child-process transport. Spawns the CLI, decodes stdout
 * lines via the shared {@link NdjsonDecoder} (arbitrary chunk boundaries
 * tolerated, exactly like the socket + ACP transports), and exposes a single
 * `sendUserPrompt` to push the prompt as a stream-json `user` envelope.
 */
export class ClaudeStreamTransport {
  readonly #child: ChildProcessByStdio<Writable, Readable, Readable>;
  readonly #decoder = new NdjsonDecoder();
  #closed = false;
  #stderr = "";
  readonly #childEnv: NodeJS.ProcessEnv;

  constructor(opts: ClaudeStreamTransportOptions) {
    const command = opts.command ?? CLAUDE_NATIVE_COMMAND;
    const args = opts.args ?? [...CLAUDE_NATIVE_ARGS];
    // SEALED SPAWN (Fix 2): stderr piped (captured, never inherited), env is the
    // credential-free allowlist — no process.env spread, no key in env/argv.
    this.#childEnv = sealedChildEnv();
    // Only pin `cwd` when the directory actually exists. A real run always passes
    // an on-disk worktree; passing a non-existent path makes `spawn` throw ENOENT.
    // (`existsSync` is a read — not policed by the fs-WRITE chokepoint guard.)
    const cwd = opts.cwd && existsSync(opts.cwd) ? opts.cwd : undefined;
    this.#child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: this.#childEnv,
      cwd,
    });
    this.#child.stdout.setEncoding("utf8");
    this.#child.stdout.on("data", (chunk: string) => this.#onData(chunk, opts));
    this.#child.stderr.setEncoding("utf8");
    this.#child.stderr.on("data", (chunk: string) => {
      this.#stderr += chunk;
    });
    this.#child.on("close", () => {
      if (this.#closed) return;
      this.#closed = true;
      opts.onClose();
    });
  }

  /** Captured child stderr (Fix 2) — for diagnostics; never the host tty. */
  get stderr(): string {
    return this.#stderr;
  }

  /** The exact sealed env handed to the child (Fix 2) — a copy, for assertions. */
  get childEnv(): Readonly<NodeJS.ProcessEnv> {
    return { ...this.#childEnv };
  }

  #onData(chunk: string, opts: ClaudeStreamTransportOptions): void {
    for (const result of this.#decoder.push(chunk)) {
      if (!result.ok) continue; // skip a malformed line, like the socket/ACP peer
      opts.onEnvelope(result.message as unknown as StreamJsonEnvelope);
    }
  }

  /**
   * Send the user prompt as a stream-json `user` envelope on stdin — the input
   * shape the CLI's `--input-format=stream-json` mode expects. The prompt text is
   * UNTRUSTED once it round-trips through the model (client-assigned taint).
   */
  sendUserPrompt(prompt: string): void {
    if (this.#closed) return;
    const envelope = {
      type: "user",
      message: { role: "user", content: [{ type: "text", text: prompt }] },
    };
    this.#child.stdin.write(JSON.stringify(envelope) + "\n");
  }

  /** Signal end-of-input (the CLI finishes the turn and emits `result`). */
  endInput(): void {
    if (this.#closed) return;
    try {
      this.#child.stdin.end();
    } catch {
      /* already gone */
    }
  }

  /** Terminate the child process. */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#child.stdin.end();
      this.#child.kill();
    } catch {
      /* already gone */
    }
  }
}
