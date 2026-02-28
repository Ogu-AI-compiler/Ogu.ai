/**
 * Slice 88 — Health Score Aggregator + Trend Analyzer
 *
 * Health score: composite org health metric from multiple signals.
 * Trend analyzer: detect trends from time-series data.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 88 — Health Score Aggregator + Trend Analyzer\x1b[0m\n");

// ── Part 1: Health Score Aggregator ──────────────────────────────

console.log("\x1b[36m  Part 1: Health Score Aggregator\x1b[0m");

const hsLib = join(process.cwd(), "tools/ogu/commands/lib/health-score.mjs");
assert("health-score.mjs exists", () => {
  if (!existsSync(hsLib)) throw new Error("file missing");
});

const hsMod = await import(hsLib);

assert("computeHealthScore returns score 0-100", () => {
  if (typeof hsMod.computeHealthScore !== "function") throw new Error("missing");
  const score = hsMod.computeHealthScore({
    tasksCompleted: 8,
    tasksTotal: 10,
    budgetEfficiency: 0.9,
    errorRate: 0.05,
    determinismScore: 95,
  });
  if (typeof score !== "number") throw new Error("should return number");
  if (score < 0 || score > 100) throw new Error(`score out of range: ${score}`);
});

assert("perfect inputs yield high score", () => {
  const score = hsMod.computeHealthScore({
    tasksCompleted: 10,
    tasksTotal: 10,
    budgetEfficiency: 1.0,
    errorRate: 0,
    determinismScore: 100,
  });
  if (score < 90) throw new Error(`expected ≥90, got ${score}`);
});

assert("poor inputs yield low score", () => {
  const score = hsMod.computeHealthScore({
    tasksCompleted: 1,
    tasksTotal: 10,
    budgetEfficiency: 0.1,
    errorRate: 0.9,
    determinismScore: 10,
  });
  if (score > 50) throw new Error(`expected ≤50, got ${score}`);
});

assert("getHealthLevel maps score to level", () => {
  if (typeof hsMod.getHealthLevel !== "function") throw new Error("missing");
  if (hsMod.getHealthLevel(95) !== "healthy") throw new Error("95 should be healthy");
  if (hsMod.getHealthLevel(60) !== "degraded") throw new Error("60 should be degraded");
  if (hsMod.getHealthLevel(20) !== "critical") throw new Error("20 should be critical");
});

// ── Part 2: Trend Analyzer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Trend Analyzer\x1b[0m");

const taLib = join(process.cwd(), "tools/ogu/commands/lib/trend-analyzer.mjs");
assert("trend-analyzer.mjs exists", () => {
  if (!existsSync(taLib)) throw new Error("file missing");
});

const taMod = await import(taLib);

assert("detectTrend identifies upward trend", () => {
  if (typeof taMod.detectTrend !== "function") throw new Error("missing");
  const data = [10, 20, 30, 40, 50];
  const trend = taMod.detectTrend(data);
  if (trend.direction !== "up") throw new Error(`expected up, got ${trend.direction}`);
});

assert("detectTrend identifies downward trend", () => {
  const data = [50, 40, 30, 20, 10];
  const trend = taMod.detectTrend(data);
  if (trend.direction !== "down") throw new Error(`expected down, got ${trend.direction}`);
});

assert("detectTrend identifies stable trend", () => {
  const data = [50, 51, 49, 50, 50];
  const trend = taMod.detectTrend(data);
  if (trend.direction !== "stable") throw new Error(`expected stable, got ${trend.direction}`);
});

assert("computeMovingAverage smooths data", () => {
  if (typeof taMod.computeMovingAverage !== "function") throw new Error("missing");
  const data = [10, 20, 30, 40, 50];
  const avg = taMod.computeMovingAverage(data, 3);
  if (!Array.isArray(avg)) throw new Error("should return array");
  if (avg.length !== 3) throw new Error(`expected 3, got ${avg.length}`);
  if (avg[0] !== 20) throw new Error(`expected first avg 20, got ${avg[0]}`);
});

assert("detectAnomalies finds outliers", () => {
  if (typeof taMod.detectAnomalies !== "function") throw new Error("missing");
  const data = [10, 11, 10, 12, 100, 11, 10];
  const anomalies = taMod.detectAnomalies(data);
  if (!Array.isArray(anomalies)) throw new Error("should return array");
  if (anomalies.length === 0) throw new Error("should detect 100 as anomaly");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
