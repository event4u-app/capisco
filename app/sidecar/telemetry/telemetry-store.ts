/**
 * Local, opt-in, scrubbed IDE self-telemetry store (road-to-real-breadth P3).
 *
 * A first-party fs-write primitive (like recent-projects / the 0600 secret file)
 * — NOT broker-gated: it is local first-party config/log, no untrusted-derived
 * egress. It holds NO SecretStore and NO source-file access, so it structurally
 * cannot read a credential or a file body ("nie aus Tresor/Code"). Disabled by
 * default; `record` is a no-op until the user opts in. Every prop value is
 * scrubbed before it touches disk: secret-bearing values dropped, home paths
 * collapsed to `~`.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { TelemetryEvent, TelemetryProvider } from "@/contracts";
import { carriesSecret } from "../cross-project/redact-excerpt.ts";

interface TelemetryFile {
  enabled: boolean;
  events: TelemetryEvent[];
}

/** Machine-wide local telemetry log path (next to recent-projects). */
export function defaultTelemetryPath(): string {
  return join(homedir(), ".config", "capisco", "telemetry.json");
}

/** Scrub a prop value: drop secret-bearing strings; collapse the home dir to `~`. */
export function scrubValue(v: string | number | boolean): string | number | boolean | undefined {
  if (typeof v !== "string") return v;
  if (carriesSecret(v)) return undefined; // never log a secret-bearing value
  const home = homedir();
  return home ? v.split(home).join("~") : v;
}

/** Scrub every prop, dropping any value that carries a secret. */
export function scrubProps(
  props: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    const s = scrubValue(v);
    if (s !== undefined) out[k] = s;
  }
  return out;
}

export class FileTelemetryStore implements TelemetryProvider {
  readonly #path: string;
  #cache: TelemetryFile | undefined;
  #tmpSeq = 0;

  constructor(path: string = defaultTelemetryPath()) {
    this.#path = path;
  }

  #load(): TelemetryFile {
    if (this.#cache) return this.#cache;
    try {
      const raw = JSON.parse(readFileSync(this.#path, "utf8")) as Partial<TelemetryFile>;
      this.#cache = {
        enabled: raw.enabled === true,
        events: Array.isArray(raw.events) ? raw.events : [],
      };
    } catch {
      this.#cache = { enabled: false, events: [] }; // strict opt-in default
    }
    return this.#cache;
  }

  #write(next: TelemetryFile): void {
    mkdirSync(dirname(this.#path), { recursive: true });
    const tmp = `${this.#path}.${process.pid}.${++this.#tmpSeq}.tmp`;
    writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
    try {
      renameSync(tmp, this.#path);
    } catch (err) {
      if (existsSync(tmp)) {
        try {
          unlinkSync(tmp);
        } catch {
          /* best effort */
        }
      }
      throw err;
    }
    this.#cache = next;
  }

  isEnabled(): Promise<boolean> {
    return Promise.resolve(this.#load().enabled);
  }

  setEnabled(on: boolean): Promise<void> {
    this.#write({ ...this.#load(), enabled: on === true });
    return Promise.resolve();
  }

  record(kind: string, props: Record<string, string | number | boolean> = {}): Promise<void> {
    const file = this.#load();
    if (!file.enabled) return Promise.resolve(); // strict opt-in: silent no-op
    const seq = (file.events[file.events.length - 1]?.seq ?? 0) + 1;
    const event: TelemetryEvent = { seq, kind, props: scrubProps(props) };
    this.#write({ ...file, events: [...file.events, event] });
    return Promise.resolve();
  }

  list(): Promise<TelemetryEvent[]> {
    return Promise.resolve([...this.#load().events]);
  }
}
