/**
 * Real ACP agent adapter — config resolver (road-to-runnable-dev P4, option 1).
 *
 * The transport (`acp-transport.ts`) already spawns the agent child as a SEALED
 * subprocess (no `process.env` spread, credential-free env allowlist, piped
 * stderr) and the session (`acp-session.ts`) already enforces the
 * CLIENT-ASSIGNED-TAINT broker seam. Swapping the deterministic stub for a real
 * ACP-capable CLI (Claude Code, Codex, Gemini …) is therefore NOT a new spawn
 * path — it is a `{command, args}` swap behind the same stdio protocol, plus a
 * key/CLI resolution that stays DORMANT until the user supplies both.
 *
 * This module is that resolution layer. It answers one question:
 *
 *   "Is a real ACP agent configured AND ready to run right now?"
 *
 * and, only when YES, hands back the `{command, args, credentialRef}` the
 * existing `AcpSession` spawn already understands. When the answer is NO (the
 * conservative default), it returns `undefined` and the caller keeps the stub.
 *
 * KEY-GATED, NOT INVENTED (hard rule). The CLI path + the key come from config /
 * env — never a baked-in default. With nothing configured the adapter is
 * dormant and the stub agent stays the default. A configured CLI alone is not
 * enough: the run is "live" only when the CLI binary resolves AND the credential
 * is present in the broker's secret vault. Until then the real run is DEFERRED.
 *
 * SECRETS STAY credentialRef-ONLY (hard rule + broker §3.2). The raw key is read
 * from config ONCE here and immediately `put` into the broker secret store under
 * a reference name. From that point only the reference NAME travels — never the
 * value. The value is injected solely at the execution layer (`SecretStore.inject`),
 * never into the child's env (the sealed allowlist is credential-free), argv, or
 * the prompt. The agent CLI is expected to read its key from its own keychain /
 * config; if a future adapter needs the key handed to the CLI, that injection
 * MUST happen inside `broker.execute`, not here.
 */

import { existsSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";
import type { CapabilityBroker } from "@/contracts";

/**
 * The resolved spawn shape for a real ACP CLI — exactly the override the
 * existing {@link AcpSession}/{@link AcpTransport} already accept. `model` is the
 * label surfaced in the session store / transcript.
 */
export interface RealAcpSpawn {
  command: string;
  args: string[];
  model: string;
  /**
   * Reference NAME of the credential in the broker secret store (never the
   * value). Present only when a key was configured + registered.
   */
  credentialRef?: string;
  /**
   * Whether the spawned agent requires the ACP `initialize` handshake before
   * `session/new` (B8 P2b). The `claude-code-acp` bridge and any standard ACP
   * CLI do; the in-repo stub does not. The session driver runs the handshake
   * only when this is `true`.
   */
  handshake?: boolean;
}

/**
 * Raw config inputs for the real adapter. Every field is OPTIONAL and sourced
 * from the environment by default (see {@link readRealAcpEnv}); explicit options
 * (tests / a future settings file) win over env. Nothing is invented — an absent
 * field keeps the adapter dormant.
 */
export interface RealAcpConfig {
  /**
   * The ACP-capable agent CLI to spawn (e.g. `claude-code`, `codex`, `gemini`).
   * A bare name is resolved against `PATH`; an absolute/relative path is used
   * as-is. Absent ⇒ dormant (stub stays default).
   */
  cliCommand?: string;
  /** Extra args prepended before the protocol drives the child (rarely needed). */
  cliArgs?: string[];
  /** Human-readable model/agent label for the transcript. Defaults to the CLI name. */
  model?: string;
  /**
   * The raw API key, read from config ONCE. It is immediately moved into the
   * broker secret vault under {@link credentialRef} and then only the reference
   * name is used. NEVER logged, NEVER passed to the child env/argv.
   */
  apiKey?: string;
  /** The reference name the key is stored under. Defaults to `acp-agent-key`. */
  credentialRef?: string;
}

/** The default reference name a configured key is stored under. */
export const DEFAULT_ACP_CREDENTIAL_REF = "acp-agent-key";

/**
 * Read the real-adapter config from the environment. These are the documented
 * enable-knobs (see app/DECISIONS.md "Enabling the real ACP agent"):
 *
 *   CAPISCO_ACP_CLI         — the agent CLI command / path (REQUIRED to leave dormant)
 *   CAPISCO_ACP_CLI_ARGS    — optional extra args, whitespace-separated
 *   CAPISCO_ACP_MODEL       — optional transcript label
 *   CAPISCO_ACP_API_KEY     — optional raw key (moved into the secret vault)
 *   CAPISCO_ACP_CRED_REF    — optional credential reference name
 *
 * Nothing is invented: an unset `CAPISCO_ACP_CLI` returns an empty-but-valid
 * config and the adapter stays dormant.
 */
export function readRealAcpEnv(env: NodeJS.ProcessEnv = process.env): RealAcpConfig {
  const cliCommand = env.CAPISCO_ACP_CLI?.trim() || undefined;
  const rawArgs = env.CAPISCO_ACP_CLI_ARGS?.trim();
  return {
    cliCommand,
    cliArgs: rawArgs ? rawArgs.split(/\s+/) : undefined,
    model: env.CAPISCO_ACP_MODEL?.trim() || undefined,
    apiKey: env.CAPISCO_ACP_API_KEY || undefined,
    credentialRef: env.CAPISCO_ACP_CRED_REF?.trim() || undefined,
  };
}

/**
 * Resolve a CLI command to an existing executable path, or `undefined` if it is
 * not installed. A bare name is searched on `PATH`; an absolute/relative path is
 * checked directly. This is the "installed CLI" half of the key-gate: a
 * configured-but-not-installed CLI keeps the adapter dormant rather than
 * spawn-failing at run time.
 */
export function resolveCliPath(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!command) return undefined;
  // An explicit path (absolute or with a separator) is used as-is.
  if (isAbsolute(command) || command.includes("/")) {
    return existsSync(command) ? command : undefined;
  }
  // A bare name is resolved against PATH.
  const pathVar = env.PATH ?? "";
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * The reason a real-adapter resolution stayed dormant — surfaced for the
 * UI/log so a half-configured setup is diagnosable WITHOUT leaking the key.
 */
export type DormantReason =
  | "no-cli-configured"
  | "cli-not-installed"
  | "key-not-available";

export interface RealAcpResolution {
  /** The spawn shape when live; `undefined` when dormant. */
  spawn?: RealAcpSpawn;
  /** Why it stayed dormant (only set when `spawn` is absent). */
  dormantReason?: DormantReason;
}

/**
 * Resolve the real ACP adapter against the broker. On success it ALSO registers
 * the configured key into the broker secret vault (so only the reference name
 * leaves this function) and returns the spawn shape. The result is LIVE only
 * when BOTH hold:
 *
 *   1. a CLI is configured AND its binary resolves on disk (installed), and
 *   2. a credential is available — either freshly registered from `apiKey`, or
 *      already present in the vault under `credentialRef`.
 *
 * Otherwise it returns `{ dormantReason }` and the caller keeps the stub.
 * Registering the key is the ONLY place the raw value is handled; afterwards the
 * adapter speaks reference names exclusively.
 */
export function resolveRealAcpAdapter(
  config: RealAcpConfig,
  broker: CapabilityBroker,
  env: NodeJS.ProcessEnv = process.env,
): RealAcpResolution {
  const command = config.cliCommand?.trim();
  if (!command) return { dormantReason: "no-cli-configured" };

  const resolved = resolveCliPath(command, env);
  if (!resolved) return { dormantReason: "cli-not-installed" };

  const credentialRef = config.credentialRef?.trim() || DEFAULT_ACP_CREDENTIAL_REF;

  // Move a freshly-configured raw key into the vault ONCE — from here on only
  // the reference name is used. The value never returns out of `put`.
  if (config.apiKey) {
    broker.secrets.put(credentialRef, config.apiKey);
  }

  // Key-gate: the run is live only when the credential is actually present in
  // the vault. A configured-but-absent key keeps the adapter dormant (deferred).
  if (!broker.secrets.has(credentialRef)) {
    return { dormantReason: "key-not-available" };
  }

  // Derive a transcript label that never echoes the key — just the CLI name.
  const model = config.model?.trim() || command;

  return {
    spawn: {
      command: resolved,
      args: config.cliArgs ?? [],
      model,
      credentialRef,
      // A generic ACP CLI configured this way speaks the standard ACP protocol,
      // so the handshake is required before session/new.
      handshake: true,
    },
  };
}

/** The npm package the Zed Claude-Code ACP bridge ships as. */
export const ACP_BRIDGE_PACKAGE = "@zed-industries/claude-code-acp";

/** The bridge's bin name once globally installed (on PATH). */
export const ACP_BRIDGE_BIN = "claude-code-acp";

/**
 * Resolve the `claude-code-acp` bridge spawn (B8 P2b) — the ACP-via-bridge
 * backend. Unlike {@link resolveRealAcpAdapter}, the bridge drives the EXISTING
 * `claude` login (the bridge translates ACP ↔ Claude Code), so it needs NO raw
 * key and is NOT key-gated. It is live when either:
 *
 *   1. an explicit `CAPISCO_ACP_CLI` resolves to an installed binary (e.g. the
 *      globally-installed `claude-code-acp` bin), OR
 *   2. nothing explicit is set but `npx` is available — then the bridge runs via
 *      `npx -y @zed-industries/claude-code-acp` (the on-demand fetch is the
 *      user's broker-approved go; this resolution only PREPARES the spawn, it
 *      does not fetch anything).
 *
 * Returns `{ dormantReason }` when neither path resolves. The spawned bridge
 * speaks standard ACP, so `handshake` is always `true`.
 */
export function resolveBridgeSpawn(
  config: RealAcpConfig,
  env: NodeJS.ProcessEnv = process.env,
): RealAcpResolution {
  const model = config.model?.trim() || "Claude Code (via ACP)";

  // 1. Explicit CLI command → must resolve to an installed binary.
  const explicit = config.cliCommand?.trim();
  if (explicit) {
    const resolved = resolveCliPath(explicit, env);
    if (!resolved) return { dormantReason: "cli-not-installed" };
    return {
      spawn: { command: resolved, args: config.cliArgs ?? [], model, handshake: true },
    };
  }

  // 2. No explicit command — prefer a globally-installed bridge bin, else npx.
  const bridgeBin = resolveCliPath(ACP_BRIDGE_BIN, env);
  if (bridgeBin) {
    return { spawn: { command: bridgeBin, args: [], model, handshake: true } };
  }

  const npx = resolveCliPath("npx", env);
  if (npx) {
    return {
      spawn: { command: npx, args: ["-y", ACP_BRIDGE_PACKAGE], model, handshake: true },
    };
  }

  return { dormantReason: "cli-not-installed" };
}
