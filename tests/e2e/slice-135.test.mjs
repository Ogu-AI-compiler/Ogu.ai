/**
 * Slice 135 — Global Search Engine + Metrics Aggregator
 *
 * Global Search Engine: full-text search across features, audit, artifacts.
 * Metrics Aggregator: unified observability with health score computation.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 135 — Global Search Engine + Metrics Aggregator\x1b[0m\n");

// ── Part 1: Global Search Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Global Search Engine\x1b[0m");

const gseLib = join(process.cwd(), "tools/ogu/commands/lib/global-search-engine.mjs");
assert("global-search-engine.mjs exists", () => {
  if (!existsSync(gseLib)) throw new Error("file missing");
});

const gseMod = await import(gseLib);

assert("createSearchEngine returns engine", () => {
  if (typeof gseMod.createSearchEngine !== "function") throw new Error("missing");
  const engine = gseMod.createSearchEngine();
  if (typeof engine.index !== "function") throw new Error("missing index");
  if (typeof engine.search !== "function") throw new Error("missing search");
});

assert("index and search returns matches", () => {
  const engine = gseMod.createSearchEngine();
  engine.index({ id: "f1", type: "feature", content: "authentication login flow", metadata: { phase: "build" } });
  engine.index({ id: "f2", type: "feature", content: "payment checkout stripe", metadata: { phase: "design" } });
  engine.index({ id: "a1", type: "audit", content: "agent dev completed authentication task", metadata: {} });

  const results = engine.search("authentication");
  if (results.length !== 2) throw new Error(`expected 2 results, got ${results.length}`);
});

assert("search is case insensitive", () => {
  const engine = gseMod.createSearchEngine();
  engine.index({ id: "d1", type: "doc", content: "Architecture Decision Record", metadata: {} });
  const results = engine.search("architecture");
  if (results.length !== 1) throw new Error(`expected 1, got ${results.length}`);
});

assert("search by type filter", () => {
  const engine = gseMod.createSearchEngine();
  engine.index({ id: "f1", type: "feature", content: "auth login", metadata: {} });
  engine.index({ id: "a1", type: "audit", content: "auth event", metadata: {} });
  const results = engine.search("auth", { type: "audit" });
  if (results.length !== 1) throw new Error(`expected 1, got ${results.length}`);
  if (results[0].id !== "a1") throw new Error("wrong result");
});

assert("search returns empty for no match", () => {
  const engine = gseMod.createSearchEngine();
  engine.index({ id: "x", type: "doc", content: "hello world", metadata: {} });
  const results = engine.search("xyznotfound");
  if (results.length !== 0) throw new Error("expected empty results");
});

assert("getStats returns index statistics", () => {
  const engine = gseMod.createSearchEngine();
  engine.index({ id: "a", type: "feature", content: "x", metadata: {} });
  engine.index({ id: "b", type: "audit", content: "y", metadata: {} });
  const stats = engine.getStats();
  if (stats.totalDocuments !== 2) throw new Error(`expected 2, got ${stats.totalDocuments}`);
  if (stats.byType.feature !== 1) throw new Error("expected 1 feature");
});

// ── Part 2: Metrics Aggregator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Metrics Aggregator\x1b[0m");

const maLib = join(process.cwd(), "tools/ogu/commands/lib/metrics-aggregator.mjs");
assert("metrics-aggregator.mjs exists", () => {
  if (!existsSync(maLib)) throw new Error("file missing");
});

const maMod = await import(maLib);

assert("createMetricsAggregator returns aggregator", () => {
  if (typeof maMod.createMetricsAggregator !== "function") throw new Error("missing");
  const agg = maMod.createMetricsAggregator();
  if (typeof agg.record !== "function") throw new Error("missing record");
  if (typeof agg.getSummary !== "function") throw new Error("missing getSummary");
  if (typeof agg.computeHealthScore !== "function") throw new Error("missing computeHealthScore");
});

assert("record and getSummary tracks metrics", () => {
  const agg = maMod.createMetricsAggregator();
  agg.record({ name: "gate.pass", value: 1 });
  agg.record({ name: "gate.pass", value: 1 });
  agg.record({ name: "gate.fail", value: 1 });
  const summary = agg.getSummary();
  if (!summary["gate.pass"]) throw new Error("missing gate.pass");
  if (summary["gate.pass"].count !== 2) throw new Error("expected 2 gate.pass");
});

assert("computeHealthScore returns 0-100", () => {
  const agg = maMod.createMetricsAggregator();
  agg.record({ name: "gate.pass", value: 1 });
  agg.record({ name: "gate.pass", value: 1 });
  agg.record({ name: "gate.pass", value: 1 });
  agg.record({ name: "gate.fail", value: 1 });
  const score = agg.computeHealthScore();
  if (typeof score !== "number") throw new Error("should return number");
  if (score < 0 || score > 100) throw new Error(`score ${score} out of range`);
});

assert("getSummary computes min/max/avg", () => {
  const agg = maMod.createMetricsAggregator();
  agg.record({ name: "latency", value: 100 });
  agg.record({ name: "latency", value: 200 });
  agg.record({ name: "latency", value: 300 });
  const summary = agg.getSummary();
  if (summary.latency.min !== 100) throw new Error(`expected min 100, got ${summary.latency.min}`);
  if (summary.latency.max !== 300) throw new Error(`expected max 300, got ${summary.latency.max}`);
  if (summary.latency.avg !== 200) throw new Error(`expected avg 200, got ${summary.latency.avg}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
