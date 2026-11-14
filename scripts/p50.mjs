// Lookup latency from Worker log lines: p50 and p95 of total_ms, uncached and cached apart
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
function* logLines(text) {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let event;
    try {
      event = JSON.parse(line);
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

const groups = { uncached: [], cached: [] };
let skipped = 0;
for (const entry of logLines(readFileSync(file, "utf8"))) {
  if (entry.route !== "POST /api/lookup" || typeof entry.total_ms !== "number") continue;
  if (entry.status !== 200) {
    skipped++;
    continue;
  }
  groups[entry.cached ? "cached" : "uncached"].push(entry.total_ms);
}

for (const [name, values] of Object.entries(groups)) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    console.log(`${name}: no lookups`);
    continue;
  }
  console.log(
    `${name}: n=${sorted.length}  p50=${percentile(sorted, 50)} ms  p95=${percentile(sorted, 95)} ms  max=${sorted.at(-1)} ms`,
  );
}
if (skipped) console.log(`(${skipped} lookups with a non-200 status left out)`);
console.log("Target: uncached p50 under 2000 ms (Worker time only).");
