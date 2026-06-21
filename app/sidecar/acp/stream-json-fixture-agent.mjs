#!/usr/bin/env node
/**
 * stream-json-fixture-agent.mjs (B8 Phase 2a) — a DETERMINISTIC stand-in for the
 * real `claude` CLI in stream-json mode. It replays the COMMITTED recorded
 * fixture (`fixtures/claude-stream-json.fixture.jsonl`) line-by-line on stdout,
 * exactly as the real CLI would emit it under
 * `claude -p --output-format=stream-json --input-format=stream-json --verbose`.
 *
 * It lets the native-adapter test exercise the full spine — sealed spawn → stdout
 * decode → pure parser → broker seam → store — WITHOUT ever invoking the real,
 * paid `claude` (a real run is the user's broker-approved go, DEFERRED). The
 * adapter cannot tell this apart from the real CLI: same protocol, same envelope
 * shapes, same stdout framing. The fixture is byte-stable, so the test is
 * reproducible.
 *
 * It reads the user prompt envelope on stdin (as the real CLI does) but its output
 * is fixed by the fixture — deterministic, no Math.random / Date.now. Pure Node,
 * no TS, no app imports. Spawned via `node stream-json-fixture-agent.mjs`.
 *
 * An optional `CAPISCO_STREAM_JSON_FIXTURE` env var overrides the fixture path
 * (used by tests that need a different recorded transcript). The sealed child env
 * allowlist does NOT include this var, so it only takes effect when a test passes
 * it explicitly through a non-sealed spawn (the replayer is itself a test fixture).
 */

import process from "node:process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const fixturePath =
  process.env.CAPISCO_STREAM_JSON_FIXTURE ||
  join(HERE, "fixtures", "claude-stream-json.fixture.jsonl");

function replayFixture() {
  let text;
  try {
    text = readFileSync(fixturePath, "utf8");
  } catch (err) {
    process.stderr.write(`fixture read failed: ${String(err)}\n`);
    process.exit(1);
    return;
  }
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  for (const line of lines) {
    // Emit verbatim — the recorded fixture is already a valid stream-json line.
    process.stdout.write(line + "\n");
  }
  // End cleanly so the transport's `onClose` fires after the terminal `result`.
  process.stdout.end(() => process.exit(0));
}

// Wait for the prompt on stdin (the real CLI consumes the user envelope before
// producing output), then replay. We don't parse the prompt — the fixture is
// fixed — but we drain stdin so the pipe doesn't stall.
let drained = false;
process.stdin.setEncoding("utf8");
process.stdin.on("data", () => {
  if (!drained) {
    drained = true;
    replayFixture();
  }
});
process.stdin.on("end", () => {
  if (!drained) {
    drained = true;
    replayFixture();
  }
});
