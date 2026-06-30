#!/usr/bin/env node
/**
 * Token-economy calibration harness (road-to-token-economy, 3 Klasse-C steps).
 *
 * Uses the REAL artifacts the IDE ships — not mocks:
 *   - compressMemory()  ../src/lib/compress/memory-compress.ts  (pure, vendored caveman ruleset)
 *   - terseDirective()  ../sidecar/acp/caveman-terse.ts         (the exact system prompt the IDE injects)
 *
 * Two modes:
 *   node scripts/calibrate.mjs            → Part A only: compression demo (PURE, FREE, no LLM)
 *   node scripts/calibrate.mjs --live     → Part A + Part B/C: real `claude -p` A/B runs (PAID — your login, your cost)
 *
 * --live spawns the `claude` CLI you are already logged into. No API key is read by this
 * script; auth is the CLI's own. Real paid calls happen ONLY in --live mode.
 */
import { compressMemory } from "../src/lib/compress/memory-compress.ts";
import { terseDirective } from "../sidecar/acp/caveman-terse.ts";
import { spawn } from "node:child_process";

const LIVE = process.argv.includes("--live");
const HAIKU = "claude-haiku-4-5";

/** Rough token estimate for prose (chars / 4). Real token counts come from the LLM result. */
const estTok = (s) => Math.round(s.length / 4);
const pct = (r) => (r * 100).toFixed(1) + "%";
const hr = () => console.log("-".repeat(72));

// A representative slab of carried IDE context (handoff summary shape). It deliberately
// mixes plain prose with PROTECTED spans — an inline `code` token, a URL, and an absolute
// path — so we can prove compression byte-preserves them.
const SAMPLE = [
  "The session worked on the worktree-runtime block. The developer asked to wire the",
  "capability broker so that every execution is gated through a single chokepoint and",
  "secrets are never placed into the LLM context. We decided to use a credentialRef-only",
  "approach and to inject the secret at the execution layer, never via env or CLI argument.",
  "",
  "The broker lives at the path /Users/dev/capisco/sidecar/broker/capability-broker.ts and",
  "the policy engine is the file policy-engine.ts next to it. The relevant function is",
  "the authorizeExecution method which returns an ExecutionGrant object.",
  "",
  "See the upstream discussion at https://github.com/event4u-app/capisco/issues/12 for the",
  "rationale. We are going to add a test that proves the grant is consumable and cannot be",
  "replayed, because we noticed that a previously issued grant could be used twice.",
].join("\n");

// A representative MECHANICAL task — the kind of thing an IDE agent answers constantly.
// Self-contained (touches no files) so the A/B is reproducible on any machine.
const TASK = [
  "Write a TypeScript function `debounce<T>` that delays calling the wrapped function",
  "until `wait` ms have passed since the last call. Include the type signature and a",
  "two-sentence explanation of when to use it.",
].join(" ");

// ----------------------------------------------------------------------------------------
// Part A — compression (PURE, FREE). Answers: does compressMemory save tokens while keeping
// the load-bearing spans byte-identical?
// ----------------------------------------------------------------------------------------
function partA() {
  console.log("\n=== PART A — context compression (compressMemory, pure, no LLM, FREE) ===\n");
  const r = compressMemory(SAMPLE);
  console.log("INPUT  chars:", r.inputChars, " (~" + estTok(SAMPLE) + " tok)");
  console.log("OUTPUT chars:", r.outputChars, " (~" + estTok(r.text) + " tok)");
  console.log("SAVED       :", pct(r.savedRatio), "of characters");
  hr();
  console.log("COMPRESSED TEXT (what the IDE would carry forward):\n");
  console.log(r.text);
  hr();
  // Byte-preservation check: every protected span must survive verbatim.
  const mustSurvive = [
    "/Users/dev/capisco/sidecar/broker/capability-broker.ts",
    "policy-engine.ts",
    "https://github.com/event4u-app/capisco/issues/12",
    "`debounce<T>`".replace(/`/g, ""), // not in sample; sanity only
  ];
  const checks = mustSurvive
    .filter((s) => SAMPLE.includes(s))
    .map((s) => ({ span: s, ok: r.text.includes(s) }));
  console.log("PROTECTED-SPAN PRESERVATION (paths / URLs / code stay byte-identical):");
  for (const c of checks) console.log("  " + (c.ok ? "OK  " : "FAIL") + "  " + c.span);
  const allOk = checks.every((c) => c.ok);
  console.log("\n  => " + (allOk ? "all protected spans preserved" : "PRESERVATION FAILURE"));
  return { savedRatio: r.savedRatio, allOk };
}

// ----------------------------------------------------------------------------------------
// Part B/C — live `claude -p` A/B (PAID). Answers: (B) does the terse directive reduce output
// tokens and is the answer still usable? (C) does a small model (haiku) suffice vs the default?
// ----------------------------------------------------------------------------------------
function runClaude({ prompt, appendSystemPrompt, model }) {
  return new Promise((resolve, reject) => {
    const args = ["-p", prompt, "--output-format", "stream-json", "--verbose"];
    if (appendSystemPrompt) args.push("--append-system-prompt", appendSystemPrompt);
    if (model) args.push("--model", model);
    const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      // stream-json emits one JSON object per line; the final type==="result" carries usage.
      let result = null;
      let assistantText = "";
      for (const line of out.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        let obj;
        try {
          obj = JSON.parse(t);
        } catch {
          continue;
        }
        if (obj.type === "result") result = obj;
        if (obj.type === "assistant" && obj.message?.content) {
          for (const block of obj.message.content) {
            if (block.type === "text") assistantText += block.text;
          }
        }
      }
      if (!result) return reject(new Error("no result message (exit " + code + ")\n" + err.slice(0, 500)));
      resolve({ result, text: assistantText || result.result || "" });
    });
  });
}

function usageLine(label, r) {
  const u = r.result.usage || {};
  const inTok = u.input_tokens ?? 0;
  const outTok = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cost = r.result.total_cost_usd;
  console.log(
    "  " + label.padEnd(22) +
    "in=" + String(inTok).padStart(6) +
    "  out=" + String(outTok).padStart(6) +
    "  cacheRead=" + String(cacheRead).padStart(6) +
    (cost != null ? "  $" + cost.toFixed(5) : ""),
  );
  return { inTok, outTok, cost };
}

async function partBC() {
  const directive = terseDirective(); // DEFAULT_TERSE_CONFIG, level "full" — what the IDE injects
  console.log("\n=== PART B — terse directive A/B (same task, default model) ===\n");
  console.log("TASK:", TASK, "\n");

  const base = await runClaude({ prompt: TASK });
  const terse = await runClaude({ prompt: TASK, appendSystemPrompt: directive });

  const b = usageLine("baseline", base);
  const t = usageLine("terse (caveman full)", terse);
  const outSave = b.outTok > 0 ? (b.outTok - t.outTok) / b.outTok : 0;
  console.log("\n  output-token delta:", pct(outSave), "fewer with terse");
  hr();
  console.log("BASELINE OUTPUT:\n" + base.text.trim() + "\n");
  hr();
  console.log("TERSE OUTPUT (judge: is it still usable?):\n" + terse.text.trim() + "\n");
  hr();

  console.log("\n=== PART C — model routing A/B (same task: default vs " + HAIKU + ") ===\n");
  const big = base; // reuse the baseline default-model run
  const small = await runClaude({ prompt: TASK, model: HAIKU });
  const big2 = usageLine("default model", big);
  const small2 = usageLine(HAIKU, small);
  if (big2.cost != null && small2.cost != null && small2.cost > 0) {
    console.log("\n  cost ratio default/small:", (big2.cost / small2.cost).toFixed(1) + "x");
  }
  hr();
  console.log("SMALL-MODEL (" + HAIKU + ") OUTPUT (judge: good enough for this task?):\n" + small.text.trim() + "\n");
  hr();
}

async function main() {
  const a = partA();
  if (!LIVE) {
    console.log("\n(Part B/C skipped — run with --live to make real `claude -p` calls.)\n");
    return;
  }
  await partBC();
  console.log("\nDONE. Paste this whole output back so I can interpret it and close the 3 calibration steps.\n");
}

main().catch((e) => {
  console.error("\ncalibrate failed:", e.message);
  process.exit(1);
});
