/**
 * Conformance: the stream-json FAKE (the recorded fixture the UI/session-tree
 * was built against) vs the REAL `claude` CLI envelope (road-to-actually-works
 * P1 / P2 stolperstein "stream-json envelope drift").
 *
 * Fast lane (always): the fixture's per-type envelope shape is stable and carries
 * the fields the parser depends on. Catches a fixture edit that drifts the fake.
 *
 * Nightly lane (opt-in, CAPISCO_CONFORMANCE_REAL=1 + claude on PATH): spawn the
 * real `claude` in stream-json mode, group envelopes by `type`, and assert the
 * fixture's shape is a SUBSET of the real one — i.e. the CLI has not dropped or
 * retyped a field the fake (and the parser) rely on. This is the single check
 * that turns "we hope the fixture matches" into "we verified it within a day".
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";

import { realLegEnabled, shapeMismatches, shapeOf, type Shape } from "./harness.ts";

// vitest runs with cwd = app/, so resolve the fixture from there (import.meta.url
// is not a file:// URL under this runner).
const FIXTURE = join(process.cwd(), "sidecar/acp/fixtures/claude-stream-json.fixture.jsonl");

type Envelope = { type?: string } & Record<string, unknown>;

function parseJsonl(text: string): Envelope[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Envelope);
}

/** Merge all envelopes of the same `type` into one shape per type. */
function shapesByType(envelopes: Envelope[]): Record<string, Shape> {
  const byType: Record<string, Envelope[]> = {};
  for (const e of envelopes) {
    const t = e.type ?? "(untyped)";
    (byType[t] ??= []).push(e);
  }
  const shapes: Record<string, Shape> = {};
  for (const [t, list] of Object.entries(byType)) {
    shapes[t] = list.map(shapeOf).reduce((a, b) => mergeObjectShapes(a, b));
  }
  return shapes;
}

function mergeObjectShapes(a: Shape, b: Shape): Shape {
  if (a.kind === "object" && b.kind === "object") {
    const keys = { ...a.keys };
    for (const [k, s] of Object.entries(b.keys)) keys[k] = keys[k] ?? s;
    return { kind: "object", keys };
  }
  return a;
}

function which(cmd: string): string | undefined {
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    const p = join(dir, cmd);
    if (p && existsSync(p)) return p;
  }
  return undefined;
}

const fixtureShapes = shapesByType(parseJsonl(readFileSync(FIXTURE, "utf8")));

describe("stream-json fixture (fake) — shape stability [fast lane]", () => {
  it("carries the four envelope types the parser handles", () => {
    expect(Object.keys(fixtureShapes).sort()).toEqual(["assistant", "result", "system", "user"]);
  });

  it("the result envelope carries usage tokens + duration (telemetry source)", () => {
    const result = fixtureShapes.result;
    expect(result.kind).toBe("object");
    if (result.kind !== "object") return;
    expect(result.keys.usage?.kind).toBe("object");
    expect(result.keys.duration_ms?.kind).toBe("primitive");
    if (result.keys.usage?.kind === "object") {
      expect(result.keys.usage.keys.input_tokens).toBeTruthy();
      expect(result.keys.usage.keys.output_tokens).toBeTruthy();
    }
  });

  it("assistant + system + user envelopes carry session_id + type", () => {
    for (const t of ["assistant", "system", "user"] as const) {
      const s = fixtureShapes[t];
      expect(s.kind).toBe("object");
      if (s.kind === "object") expect(s.keys.session_id).toBeTruthy();
    }
  });
});

describe("stream-json conformance — fake vs REAL claude [nightly, opt-in]", () => {
  const claude = which("claude");
  const run = realLegEnabled() && claude ? it : it.skip;

  run(
    "the fixture shape is a subset of the real claude stream-json envelope",
    async () => {
      const lines = await new Promise<string>((resolve, reject) => {
        execFile(
          claude as string,
          ["-p", "reply with exactly: hi", "--output-format", "stream-json", "--verbose"],
          { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
          (err, stdout) => (err && !stdout ? reject(err) : resolve(stdout)),
        );
      });
      const realShapes = shapesByType(parseJsonl(lines));
      const problems: string[] = [];
      for (const [type, fakeShape] of Object.entries(fixtureShapes)) {
        const realShape = realShapes[type];
        if (!realShape) {
          problems.push(`type "${type}" present in fixture, absent from real run`);
          continue;
        }
        problems.push(...shapeMismatches(fakeShape, realShape, `${type}`));
      }
      expect(problems, `stream-json drift:\n${problems.join("\n")}`).toEqual([]);
    },
    90_000,
  );
});
