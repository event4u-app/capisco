/**
 * Real shared signal rail (road-to-real-breadth P3, §5.2): folds PR-status,
 * container-health and observability(Sentry) signals onto ONE deduplicated
 * `SignalItem` rail, then routes each source to a channel (alerts / inspect)
 * via the dumb rules — exactly what the mock served, now backed by the live
 * providers.
 *
 * Each source is an injected async fn so this stays pure-of-transport: the
 * dev-bridge wires the fns to the registered real providers (forge → prsToSignals,
 * runtime → servicesToSignals, sentry → toSignals). A source is optional and a
 * source that throws contributes nothing — one dead provider never blanks the rail.
 *
 * Dedup is by `id`: every source namespaces its ids (`pr:`, `container:`,
 * `sentry:`), so dedup removes a source re-emitting the same row, never collapses
 * two genuinely-distinct signals. (Cross-source semantic dedup needs a shared
 * correlation key the sources do not carry — out of scope, noted in the roadmap.)
 */

import type { SignalItem, SignalProvider, SignalRule } from "@/contracts";

/** Default routing — mirrors the mock: PR/container/observability/agent → alerts, lint → inspect. */
export const DEFAULT_SIGNAL_RULES: readonly SignalRule[] = [
  { id: "rule-pr", source: "pr", channel: "alerts", enabled: true },
  { id: "rule-container", source: "container", channel: "alerts", enabled: true },
  { id: "rule-obs", source: "observability", channel: "alerts", enabled: true },
  { id: "rule-agent", source: "agent", channel: "alerts", enabled: true },
  { id: "rule-lint", source: "lint", channel: "inspect", enabled: true },
];

/** Per-source async producers. Absent → that source is simply not on the rail. */
export interface SignalSources {
  pr?: () => Promise<SignalItem[]>;
  container?: () => Promise<SignalItem[]>;
  observability?: () => Promise<SignalItem[]>;
}

export class RealSignalProvider implements SignalProvider {
  readonly #sources: SignalSources;
  readonly #rules: readonly SignalRule[];

  constructor(sources: SignalSources, rules: readonly SignalRule[] = DEFAULT_SIGNAL_RULES) {
    this.#sources = sources;
    this.#rules = rules;
  }

  async listSignals(): Promise<SignalItem[]> {
    const fns = [this.#sources.pr, this.#sources.container, this.#sources.observability].filter(
      (f): f is () => Promise<SignalItem[]> => typeof f === "function",
    );
    // A dead source contributes [] — it never blanks the whole rail.
    const lists = await Promise.all(fns.map((f) => f().catch(() => [] as SignalItem[])));
    const seen = new Set<string>();
    const out: SignalItem[] = [];
    for (const item of lists.flat()) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }

  listRules(): Promise<SignalRule[]> {
    return Promise.resolve([...this.#rules]);
  }

  async signalsFor(channel: "alerts" | "inspect"): Promise<SignalItem[]> {
    const routed = new Set(
      this.#rules.filter((r) => r.enabled && r.channel === channel).map((r) => r.source),
    );
    return (await this.listSignals()).filter((s) => routed.has(s.source));
  }
}
