#!/usr/bin/env node
/**
 * Regenerate `agents/roadmaps-progress.md` from the roadmap sources.
 *
 * The dashboard is a derived projection of the `[ ]`/`[x]`/`[~]`/`[-]`
 * checkboxes under each `## Phase N — …` heading in every top-level roadmap
 * (archive/ · skipped/ · later/ are excluded). Zero-dependency Node ESM so it
 * runs from `task roadmap-progress` without an install step.
 *
 * Glyph semantics (single source of truth, mirrors the agent roadmap rules):
 *   [ ] open · [x] done · [~] deferred · [-] cancelled.
 *
 * Usage:  node app/scripts/roadmap-progress.mjs [--check]
 *   --check exits non-zero if the committed dashboard is stale (CI guard).
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROADMAP_DIR = join(ROOT, "agents", "roadmaps");
const OUT = join(ROADMAP_DIR, "..", "roadmaps-progress.md");

const CHECKBOX = /^\s*-\s+\[([ x~-])\]/;
const PHASE = /^##\s+Phase\s+(\S+)\s+—\s+(.*?)\s*$/;
const H1 = /^#\s+(.+?)\s*$/;

/** Parse one roadmap file into { title, phases: [{num,name,open,done,deferred,cancelled}] }. */
function parseRoadmap(text) {
  let title = "";
  const phases = [];
  let cur = null;
  for (const line of text.split("\n")) {
    const h1 = H1.exec(line);
    if (h1 && !title && !line.startsWith("##")) {
      title = h1[1];
      continue;
    }
    const ph = PHASE.exec(line);
    if (ph) {
      cur = { num: ph[1], name: ph[2], open: 0, done: 0, deferred: 0, cancelled: 0 };
      phases.push(cur);
      continue;
    }
    if (line.startsWith("## ")) {
      cur = null; // a non-Phase section — its checkboxes are not counted
      continue;
    }
    const cb = CHECKBOX.exec(line);
    if (cb && cur) {
      const mark = cb[1];
      if (mark === "x") cur.done++;
      else if (mark === "~") cur.deferred++;
      else if (mark === "-") cur.cancelled++;
      else cur.open++;
    }
  }
  return { title, phases };
}

const totalOf = (p) => p.open + p.done + p.deferred + p.cancelled;
const pct = (done, total) => (total === 0 ? 0 : Math.round((done / total) * 100));

function bar(p, width) {
  const filled = Math.round((p / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function phaseState(ph) {
  const total = totalOf(ph);
  if (total > 0 && ph.open === 0) return "✅ done";
  if (ph.done === 0) return "⬜ not started";
  return "🟡 in progress";
}

function render(roadmaps) {
  let sumDone = 0;
  let sumTotal = 0;
  const rows = roadmaps.map((r) => {
    const open = r.phases.reduce((n, p) => n + p.open, 0);
    const done = r.phases.reduce((n, p) => n + p.done, 0);
    const deferred = r.phases.reduce((n, p) => n + p.deferred, 0);
    const cancelled = r.phases.reduce((n, p) => n + p.cancelled, 0);
    const steps = open + done + deferred + cancelled;
    sumDone += done;
    sumTotal += steps;
    return { ...r, open, done, deferred, cancelled, steps, pct: pct(done, steps) };
  });

  const overall = pct(sumDone, sumTotal);
  const out = [];
  out.push("# Roadmap Progress");
  out.push("");
  out.push(
    "> Auto-generated — do not edit. Regenerate with `task roadmap-progress` or by running the `update_roadmap_progress` script for your install; rewritten on every roadmap create / execute / completion change (timestamp lives in git history).",
  );
  out.push(">");
  out.push(
    `> ${rows.length} open roadmaps · [roadmaps/](roadmaps/) · [archive/](roadmaps/archive/) · [skipped/](roadmaps/skipped/) · [later/](roadmaps/later/)`,
  );
  out.push("");
  out.push("## Overall");
  out.push("");
  out.push(`**${sumDone} / ${sumTotal} steps done · ${overall}%**`);
  out.push("");
  out.push("```text");
  out.push(`${bar(overall, 40)}   ${overall}%`);
  out.push("```");
  out.push("");
  out.push("## Open roadmaps");
  out.push("");
  out.push("| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Progress |");
  out.push("|---|---|---:|---:|---:|---:|---:|---:|---|");
  rows.forEach((r, i) => {
    out.push(
      `| ${i + 1} | [${r.file}](roadmaps/${r.file}) | ${r.phases.length} | ${r.steps} | ${r.open} | ${r.done} | ${r.deferred} | ${r.cancelled} | ${bar(r.pct, 10)} ${r.pct}% |`,
    );
  });
  out.push("");
  out.push("---");
  out.push("");
  out.push("## Per-roadmap phase breakdown");
  for (const r of rows) {
    out.push("");
    out.push(`### [${r.file}](roadmaps/${r.file})`);
    out.push("");
    out.push(`**${r.title}** — ${r.done} / ${r.steps} done (${r.pct}%)`);
    out.push("");
    out.push("| # | Phase | State | Open | Done | Deferred | Cancelled | % |");
    out.push("|---|---|---|---:|---:|---:|---:|---:|");
    for (const p of r.phases) {
      out.push(
        `| ${p.num} | ${p.name} | ${phaseState(p)} | ${p.open} | ${p.done} | ${p.deferred} | ${p.cancelled} | ${pct(p.done, totalOf(p))}% |`,
      );
    }
  }
  out.push("");
  return out.join("\n");
}

const files = readdirSync(ROADMAP_DIR)
  .filter((f) => f.endsWith(".md") && f.startsWith("road-to-"))
  .sort();
const roadmaps = files.map((file) => ({
  file,
  ...parseRoadmap(readFileSync(join(ROADMAP_DIR, file), "utf8")),
}));
const rendered = render(roadmaps);

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current.trim() !== rendered.trim()) {
    console.error("roadmaps-progress.md is stale — run `task roadmap-progress`.");
    process.exit(1);
  }
  console.log("roadmaps-progress.md is up to date.");
} else {
  writeFileSync(OUT, rendered);
  console.log(`Wrote ${OUT}`);
}
