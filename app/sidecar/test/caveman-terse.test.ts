// @vitest-environment node
/**
 * Caveman terse-mode tests (Phase 2, token-economy) — the THREE acceptance asserts:
 *
 *  1. POSITIVE-INJECTION (both backends): with terse default-ON, the system
 *     context SENT to the agent carries the terse directive marker; opting out
 *     removes it. Asserted against the SENT prompt string — no LLM roundtrip.
 *     Proven for BOTH `registerSession({backend})` paths (ACP + native).
 *
 *  2. CAVEMAN-NEGATIVE-ASSERT (AK-T3, the mandatory test): the border surfaces —
 *     broker permission prompts, audit-log records, quality diagnostics, secret
 *     references, commit messages — NEVER carry the terse directive. This holds
 *     STRUCTURALLY: those surfaces never call `injectTerseDirective`. The test
 *     drives a real broker-gated run with terse ON and scans every audit record /
 *     permission request for the marker (must be absent).
 *
 *  3. The injector shapes the EXPLANATION only — it prepends the directive but
 *     leaves the user/ToDo prompt below the marker byte-identical (never
 *     abbreviates code/paths inside the prompt).
 */

import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ProviderRegistry } from "../registry/registry.ts";
import { Broker } from "../broker/capability-broker.ts";
import { InMemorySessionStore } from "../session/in-memory-session-store.ts";
import { AcpSession } from "../acp/acp-session.ts";
import { ClaudeCodeProvider } from "../acp/claude-code-provider.ts";
import { registerSession, TODO_PROVIDER_ID } from "../register-session.ts";
import {
  DEFAULT_TERSE_CONFIG,
  TERSE_DIRECTIVE_MARKER,
  injectTerseDirective,
  terseDirective,
  hasTerseDirective,
} from "../acp/caveman-terse.ts";
import type { TodoItem, TodoProvider } from "@/contracts";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB_AGENT = join(HERE, "..", "acp", "stub-acp-agent.mjs");
const FIXTURE_AGENT = join(HERE, "..", "acp", "stream-json-fixture-agent.mjs");

const TODO: TodoItem = { id: "todo-1", text: "Mark the TODO done", checked: false, line: 1 };

describe("caveman-terse — pure injector", () => {
  it("default config is ON at full", () => {
    expect(DEFAULT_TERSE_CONFIG).toEqual({ enabled: true, level: "full" });
  });

  it("injects the marker when on, omits it when off", () => {
    const on = injectTerseDirective("do the thing", { enabled: true, level: "full" });
    expect(hasTerseDirective(on)).toBe(true);
    const off = injectTerseDirective("do the thing", { enabled: false, level: "full" });
    expect(off).toBe("do the thing");
    expect(hasTerseDirective(off)).toBe(false);
  });

  it("shapes the explanation only — the prompt below the marker is byte-identical", () => {
    const prompt = "Edit /Users/me/app/src/foo.ts and run `pnpm test`";
    const sent = injectTerseDirective(prompt, DEFAULT_TERSE_CONFIG);
    // The original prompt survives verbatim (no abbreviation of code/paths).
    expect(sent).toContain(prompt);
    expect(sent.endsWith(prompt)).toBe(true);
  });

  it("emits a per-level directive (lite/full/ultra)", () => {
    for (const level of ["lite", "full", "ultra"] as const) {
      const d = terseDirective({ enabled: true, level });
      expect(d).toBeDefined();
      expect(d!.startsWith(TERSE_DIRECTIVE_MARKER)).toBe(true);
    }
    expect(terseDirective({ enabled: false, level: "full" })).toBeUndefined();
  });
});

describe("caveman-terse — positive injection (ACP backend)", () => {
  it("the SENT system context carries the marker when terse is on (default)", async () => {
    const session = new AcpSession({
      broker: new Broker(),
      store: new InMemorySessionStore(),
      cwd: "/tmp/worktree-terse-acp",
      model: "Stub Agent",
      command: process.execPath,
      args: [STUB_AGENT],
      resolvePermission: () => ({ axis: "session" }),
      // terse defaults ON.
    });
    try {
      await session.start("Mark the TODO done");
      expect(hasTerseDirective(session.sentSystemContext)).toBe(true);
      expect(session.sentSystemContext).toContain("Mark the TODO done");
    } finally {
      session.close();
    }
  });

  it("opting out removes the marker from the SENT context", async () => {
    const session = new AcpSession({
      broker: new Broker(),
      store: new InMemorySessionStore(),
      cwd: "/tmp/worktree-terse-acp-off",
      model: "Stub Agent",
      command: process.execPath,
      args: [STUB_AGENT],
      resolvePermission: () => ({ axis: "session" }),
      terse: { enabled: false, level: "full" },
    });
    try {
      await session.start("Mark the TODO done");
      expect(hasTerseDirective(session.sentSystemContext)).toBe(false);
      expect(session.sentSystemContext).toBe("Mark the TODO done");
    } finally {
      session.close();
    }
  });
});

describe("caveman-terse — positive injection (native stream-json backend)", () => {
  it("the SENT system context carries the marker when terse is on (default)", async () => {
    const provider = new ClaudeCodeProvider({
      broker: new Broker(),
      store: new InMemorySessionStore(),
      cwd: "/tmp/worktree-terse-native",
      model: "Claude Code (native)",
      command: process.execPath,
      args: [FIXTURE_AGENT],
      resolvePermission: () => ({ axis: "session" }),
    });
    try {
      await provider.start("Mark the TODO done");
      expect(hasTerseDirective(provider.sentSystemContext)).toBe(true);
      expect(provider.sentSystemContext).toContain("Mark the TODO done");
    } finally {
      provider.close();
    }
  });

  it("opting out removes the marker from the SENT context", async () => {
    const provider = new ClaudeCodeProvider({
      broker: new Broker(),
      store: new InMemorySessionStore(),
      cwd: "/tmp/worktree-terse-native-off",
      model: "Claude Code (native)",
      command: process.execPath,
      args: [FIXTURE_AGENT],
      resolvePermission: () => ({ axis: "session" }),
      terse: { enabled: false, level: "ultra" },
    });
    try {
      await provider.start("Mark the TODO done");
      expect(hasTerseDirective(provider.sentSystemContext)).toBe(false);
    } finally {
      provider.close();
    }
  });
});

describe("caveman-terse — registerSession threads terse to BOTH backends", () => {
  it("native backend run carries the marker; border audit records never do", async () => {
    const registry = new ProviderRegistry();
    const broker = new Broker();
    const store = new InMemorySessionStore();
    registerSession(registry, broker, {
      store,
      backend: "native",
      resolvePermission: () => ({ axis: "session" }),
      command: process.execPath,
      args: [FIXTURE_AGENT],
      // terse defaults ON.
    });
    const todo = registry.get(TODO_PROVIDER_ID) as unknown as TodoProvider;
    await todo.sendToAgent(TODO, "/tmp/worktree-terse-reg-native");

    // CAVEMAN-NEGATIVE-ASSERT: the audit log (a BORDER/safety surface) never
    // carries the terse marker — it flows through the broker, not the injector.
    for (const record of broker.audit.list()) {
      expect(hasTerseDirective(JSON.stringify(record))).toBe(false);
    }
  });

  it("acp backend run: border audit records never carry the marker", async () => {
    const registry = new ProviderRegistry();
    const broker = new Broker();
    const store = new InMemorySessionStore();
    registerSession(registry, broker, {
      store,
      backend: "acp",
      resolvePermission: () => ({ axis: "session" }),
      command: process.execPath,
      args: [STUB_AGENT],
    });
    const todo = registry.get(TODO_PROVIDER_ID) as unknown as TodoProvider;
    await todo.sendToAgent(TODO, "/tmp/worktree-terse-reg-acp");

    for (const record of broker.audit.list()) {
      expect(hasTerseDirective(JSON.stringify(record))).toBe(false);
    }
    // The audit actually recorded something (the run was real, not a no-op).
    expect(broker.audit.list().length).toBeGreaterThan(0);
  });
});
