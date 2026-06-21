#!/usr/bin/env node
/**
 * rtk-fixture-filter.mjs (token-economy Phase 3) — a DETERMINISTIC stand-in for
 * the real external `rtk` Rust binary. It reads the raw long-tail tool output on
 * stdin and writes a compacted form on stdout, exactly as the real `rtk` would
 * (same stdin→stdout contract the `rtk-exec.ts` primitive speaks).
 *
 * It lets the RTK test exercise the full spawn spine — execFile (no shell) →
 * stdin write → stdout read → branded LlmFacingOnly observation — WITHOUT the
 * real binary installed (the real `rtk` install is the user's broker-approved
 * go, DEFERRED). The compaction here mirrors the pure `parseLongTail` parser so
 * the golden fixture is byte-stable at a "pinned RTK version".
 *
 * Pure Node, no TS, no app imports, no Math.random / Date.now — deterministic.
 */

import process from "node:process";

const NOISE_LINE = /^\s*(total\s+\d+|\.{1,2}\/?)\s*$/;

function compact(raw) {
  const lines = raw.split("\n").map((l) => l.replace(/[ \t]+$/g, ""));
  const kept = [];
  let blankRun = 0;
  for (const line of lines) {
    if (NOISE_LINE.test(line)) continue;
    if (line.trim() === "") {
      blankRun += 1;
      if (blankRun > 1) continue;
      kept.push("");
      continue;
    }
    blankRun = 0;
    kept.push(line);
  }
  while (kept.length && kept[0] === "") kept.shift();
  while (kept.length && kept[kept.length - 1] === "") kept.pop();
  return kept.join("\n");
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  process.stdout.write(compact(input));
});
