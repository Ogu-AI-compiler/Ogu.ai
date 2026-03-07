/**
 * Slice 58 — Metric Collector Engine
 *
 * Metric collector: counters, gauges, histograms for system observability.

 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice58-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 58 — Metric Collector Engine\x1b[0m\n");
console.log("  Counters, gauges, histograms, threshold alerting\n");

// ── Part 1: Metric Collector ──────────────────────────────

console.log("\x1b[36m  Part 1: Metric Collector\x1b[0m");

const metricLib = join(process.cwd(), "tools/ogu/commands/lib/metric-collector.mjs");
assert("metric-collector.mjs exists", () => {
  if (!existsSync(metricLib)) throw new Error("file missing");
});

const metricMod = await import(metricLib);

assert("createCollector returns collector instance", () => {
  if (typeof metricMod.createCollector !== "function") throw new Error("missing");
  const c = metricMod.createCollector();
  if (typeof c.counter !== "function") throw new Error("missing counter");
  if (typeof c.gauge !== "function") throw new Error("missing gauge");
  if (typeof c.histogram !== "function") throw new Error("missing histogram");
  if (typeof c.getAll !== "function") throw new Error("missing getAll");
});

assert("counter increments correctly", () => {
  const c = metricMod.createCollector();
  c.counter("requests.total");
  c.counter("requests.total");
  c.counter("requests.total", 3);
  const all = c.getAll();
  if (all["requests.total"]?.value !== 5) throw new Error(`expected 5, got ${all["requests.total"]?.value}`);
  if (all["requests.total"]?.type !== "counter") throw new Error("wrong type");
});

assert("gauge sets value", () => {
  const c = metricMod.createCollector();
  c.gauge("cpu.percent", 45);
  c.gauge("cpu.percent", 72);
  const all = c.getAll();
  if (all["cpu.percent"]?.value !== 72) throw new Error(`expected 72, got ${all["cpu.percent"]?.value}`);
});

assert("histogram records distribution", () => {
  const c = metricMod.createCollector();
  c.histogram("response.time", 120);
  c.histogram("response.time", 200);
  c.histogram("response.time", 150);
  c.histogram("response.time", 300);
  const all = c.getAll();
  const h = all["response.time"];
  if (h?.type !== "histogram") throw new Error("wrong type");
  if (h?.count !== 4) throw new Error(`expected 4 samples, got ${h?.count}`);
  if (typeof h?.min !== "number" || h.min !== 120) throw new Error("wrong min");
  if (typeof h?.max !== "number" || h.max !== 300) throw new Error("wrong max");
  if (typeof h?.avg !== "number") throw new Error("missing avg");
});

assert("reset clears all metrics", () => {
  const c = metricMod.createCollector();
  c.counter("a");
  c.gauge("b", 10);
  if (typeof c.reset !== "function") throw new Error("missing reset");
  c.reset();
  const all = c.getAll();
  if (Object.keys(all).length !== 0) throw new Error("should be empty after reset");
});

assert("METRIC_TYPES lists all types", () => {
  if (!metricMod.METRIC_TYPES) throw new Error("missing");
  if (!metricMod.METRIC_TYPES.includes("counter")) throw new Error("missing counter");
  if (!metricMod.METRIC_TYPES.includes("gauge")) throw new Error("missing gauge");
  if (!metricMod.METRIC_TYPES.includes("histogram")) throw new Error("missing histogram");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
