// Lookup latency from Worker log lines: p50 and p95 of total_ms, per language, uncached and cached apart
//
// npx wrangler tail --format json > tail.log      (leave running while you tap words, then Ctrl+C)
// node scripts/p50.mjs tail.log
// total_ms is measured inside the Worker: it leaves out the phone's network time
/* global console, process */
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/p50.mjs <log file from wrangler tail --format json>");
  process.exit(1);
}

// Each tail event carries our JSON log line as a string in logs[].message[]
// Events are one per line or pretty-printed (PowerShell adds a BOM); each starts with "{" in column 0
function* logLines(text) {
  for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n(?=\{)/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    let event;
    try {
      event = JSON.parse(chunk);
    } catch {
      continue;
    }
    for (const entry of event.logs ?? []) {
      for (const message of entry.message ?? []) {
        if (typeof message !== "string") continue;
        try {
          yield JSON.parse(message);
        } catch {
          // not one of our log lines
        }
      }
    }
    if (event.route) yield event; // already a plain log line
  }
}

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

// Keys: "<language or all> uncached|cached". Lines from before `lang` was logged count as "unknown"
const groups = new Map();
const add = (key, ms) => groups.set(key, [...(groups.get(key) ?? []), ms]);
let skipped = 0;
for (const entry of logLines(readFileSync(file, "utf8"))) {
  if (entry.route !== "POST /api/lookup" || typeof entry.total_ms !== "number") continue;
  if (entry.status !== 200) {
    skipped++;
    continue;
  }
  const kind = entry.cached ? "cached" : "uncached";
  add(`all ${kind}`, entry.total_ms);
  add(`${entry.lang ?? "unknown"} ${kind}`, entry.total_ms);
}

const names = ["all", ...[...new Set([...groups.keys()].map((k) => k.split(" ")[0]))].filter((n) => n !== "all").sort()];
for (const name of names) {
  for (const kind of ["uncached", "cached"]) {
    const sorted = [...(groups.get(`${name} ${kind}`) ?? [])].sort((a, b) => a - b);
    const label = `${name} ${kind}:`.padEnd(18);
    if (sorted.length === 0) {
      console.log(`${label} no lookups`);
      continue;
    }
    console.log(
      `${label} n=${sorted.length}  p50=${percentile(sorted, 50)} ms  p95=${percentile(sorted, 95)} ms  max=${sorted.at(-1)} ms`,
    );
  }
}
if (skipped) console.log(`(${skipped} lookups with a non-200 status left out)`);
console.log("Target: uncached p50 under 2000 ms (Worker time only).");
