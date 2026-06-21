/**
 * Capability-Broker wiring (B4). Registers the RPC-safe {@link BrokerProvider}
 * surface on the registry under a stable id, and returns the full in-process
 * {@link Broker} for the execution-layer consumer (which the wire never sees).
 *
 * The broker is the chokepoint that B3 (ACP) wires BEHIND — built first, on
 * purpose, so the ACP stub can never act around it.
 */

import type { GrantConfig } from "@/contracts";
import type { ProviderRegistry } from "./registry/registry.ts";
import { Broker } from "./broker/capability-broker.ts";
import { BrokerProvider } from "./broker/broker-provider.ts";

/** The broker provider id on the wire. */
export const BROKER_PROVIDER_ID = "broker";

export interface RegisterBrokerOptions {
  config?: GrantConfig;
  projectKey?: string;
  /** Human-confirmed production datasource names (read-only invariant §3.3). */
  productionDatasources?: ReadonlySet<string>;
}

export function registerBroker(
  registry: ProviderRegistry,
  opts: RegisterBrokerOptions = {},
): Broker {
  const broker = new Broker({
    config: opts.config,
    projectKey: opts.projectKey,
    productionDatasources: opts.productionDatasources,
  });
  registry.register(BROKER_PROVIDER_ID, new BrokerProvider(broker) as never);
  return broker;
}
