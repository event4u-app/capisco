// @vitest-environment node
/**
 * Sentry integration kill-switch (road-to-sentry-observability P1). Proves the
 * runtime toggle, the force-disable override, and — the load-bearing part — that
 * a disabled switch returns empty reads WITHOUT touching the inner provider (no
 * polling / API hit / fixture read while off).
 */

import { describe, expect, it, vi } from "vitest";

import {
  SentryKillSwitch,
  createGatedSentryProvider,
  createGatedSentryCore,
} from "../sentry/sentry-kill-switch.ts";
import { ProviderRegistry } from "../registry/registry.ts";
import {
  registerSentry,
  SENTRY_PROVIDER_ID,
  SENTRY_CONTROL_PROVIDER_ID,
} from "../register-sentry.ts";
import type { SentryControlProvider, SentryReadProvider } from "@/contracts";

function spyProvider(): SentryReadProvider & { calls: () => number } {
  let calls = 0;
  const bump = <T>(v: T) => {
    calls += 1;
    return Promise.resolve(v);
  };
  return {
    org: "acme",
    toSignals: () => [],
    listIssues: () => bump([{ id: "1" } as never]),
    listCrons: () => bump([{ name: "c" } as never]),
    getStats: () => bump({ errors24h: 7 } as never),
    listAlertRules: () => bump([{ name: "a" } as never]),
    calls: () => calls,
  };
}

describe("SentryKillSwitch", () => {
  it("is enabled by default; the runtime toggle flips it without a restart", () => {
    const kill = new SentryKillSwitch();
    expect(kill.enabled()).toBe(true);
    kill.setEnabled(false);
    expect(kill.enabled()).toBe(false);
    kill.setEnabled(true);
    expect(kill.enabled()).toBe(true);
  });

  it("a force-disable override wins over the runtime toggle", () => {
    const kill = new SentryKillSwitch({ forceDisabled: true });
    expect(kill.enabled()).toBe(false);
    expect(kill.forced()).toBe(true);
    kill.setEnabled(true); // operator tries to turn it on…
    expect(kill.enabled()).toBe(false); // …the force-disable still wins.
  });
});

describe("createGatedSentryProvider", () => {
  it("passes reads through while enabled", async () => {
    const inner = spyProvider();
    const gated = createGatedSentryProvider(inner, new SentryKillSwitch());
    expect(await gated.listIssues()).toHaveLength(1);
    expect((await gated.getStats()).errors24h).toBe(7);
    expect(inner.calls()).toBe(2);
    expect(gated.org).toBe("acme");
  });

  it("returns empty reads and NEVER touches the inner provider while disabled", async () => {
    const inner = spyProvider();
    const kill = new SentryKillSwitch();
    const gated = createGatedSentryProvider(inner, kill);
    kill.setEnabled(false);

    expect(await gated.listIssues()).toEqual([]);
    expect(await gated.listCrons()).toEqual([]);
    expect(await gated.listAlertRules()).toEqual([]);
    expect(await gated.getStats()).toEqual({
      errors24h: 0,
      errorsTrend: "",
      crashFree: "",
      failingCrons: 0,
      p95: "",
      apdex: 0,
    });
    // The inner provider was never called — "off" is inert, not merely hidden.
    expect(inner.calls()).toBe(0);
  });

  it("re-enabling resumes upstream reads", async () => {
    const inner = spyProvider();
    const kill = new SentryKillSwitch();
    const gated = createGatedSentryProvider(inner, kill);
    kill.setEnabled(false);
    await gated.listIssues();
    kill.setEnabled(true);
    await gated.listIssues();
    expect(inner.calls()).toBe(1);
  });

  it("the pure toSignals projection stays available regardless of switch state", () => {
    const inner = spyProvider();
    const toSignals = vi.spyOn(inner, "toSignals");
    const kill = new SentryKillSwitch();
    const gated = createGatedSentryProvider(inner, kill);
    kill.setEnabled(false);
    gated.toSignals([]);
    expect(toSignals).toHaveBeenCalled();
  });
});

describe("createGatedSentryCore — issues-only real provider", () => {
  function coreSpy() {
    let calls = 0;
    return {
      org: "acme",
      toSignals: () => [],
      listIssues: () => {
        calls += 1;
        return Promise.resolve([{ id: "1" } as never]);
      },
      calls: () => calls,
    };
  }

  it("passes listIssues through while enabled", async () => {
    const inner = coreSpy();
    const gated = createGatedSentryCore(inner, new SentryKillSwitch());
    expect(await gated.listIssues()).toHaveLength(1);
    expect(inner.calls()).toBe(1);
    expect(gated.org).toBe("acme");
  });

  it("returns empty and never calls the real API while disabled", async () => {
    const inner = coreSpy();
    const kill = new SentryKillSwitch();
    const gated = createGatedSentryCore(inner, kill);
    kill.setEnabled(false);
    expect(await gated.listIssues()).toEqual([]);
    expect(inner.calls()).toBe(0); // no HTTP hit to Sentry while off
  });
});

describe("registerSentry — kill-switch wiring", () => {
  it("registers the GATED read provider + control; the control's toggle gates reads", async () => {
    const registry = new ProviderRegistry();
    registerSentry(registry);

    const sentry = registry.get(SENTRY_PROVIDER_ID) as unknown as SentryReadProvider;
    const control = registry.get(
      SENTRY_CONTROL_PROVIDER_ID,
    ) as unknown as SentryControlProvider;

    // Enabled by default: the fixture issues come through.
    expect(await control.isEnabled()).toBe(true);
    expect((await sentry.listIssues()).length).toBeGreaterThan(0);

    // Flip off over the control surface → the same read provider goes empty.
    await control.setEnabled(false);
    expect(await control.isEnabled()).toBe(false);
    expect(await sentry.listIssues()).toEqual([]);

    // Not forced (no env / manifest override in this boot).
    expect(await control.isForced()).toBe(false);
  });

  it("boots hard-off when force-disabled (manifest/env override)", async () => {
    const registry = new ProviderRegistry();
    registerSentry(registry, { forceDisabled: true });
    const control = registry.get(
      SENTRY_CONTROL_PROVIDER_ID,
    ) as unknown as SentryControlProvider;
    expect(await control.isEnabled()).toBe(false);
    expect(await control.isForced()).toBe(true);
    // The operator toggle cannot override a force-disable.
    await control.setEnabled(true);
    expect(await control.isEnabled()).toBe(false);
  });
});
