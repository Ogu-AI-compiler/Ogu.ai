/**
 * Slice 133 — Trend Analysis Engine
 *

 * Trend Analysis Engine: org-level trend analysis and anomaly detection.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 133 — Trend Analysis Engine\x1b[0m\n");

// ── Part 1: Trend Analysis Engine ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Trend Analysis Engine\x1b[0m");

const taeLib = join(process.cwd(), "tools/ogu/commands/lib/trend-analysis-engine.mjs");
assert("trend-analysis-engine.mjs exists", () => {
  if (!existsSync(taeLib)) throw new Error("file missing");
});

const taeMod = await import(taeLib);

assert("createTrendEngine returns engine", () => {
  if (typeof taeMod.createTrendEngine !== "function") throw new Error("missing");
  const engine = taeMod.createTrendEngine();
  if (typeof engine.addDataPoint !== "function") throw new Error("missing addDataPoint");
  if (typeof engine.getTrend !== "function") throw new Error("missing getTrend");
  if (typeof engine.detectAnomalies !== "function") throw new Error("missing detectAnomalies");
});

assert("addDataPoint stores metric data", () => {
  const engine = taeMod.createTrendEngine();
  engine.addDataPoint({ metric: "gate_pass_rate", value: 0.95, timestamp: 1 });
  engine.addDataPoint({ metric: "gate_pass_rate", value: 0.90, timestamp: 2 });
  const trend = engine.getTrend("gate_pass_rate");
  if (trend.dataPoints !== 2) throw new Error(`expected 2 data points, got ${trend.dataPoints}`);
});

assert("getTrend computes direction", () => {
  const engine = taeMod.createTrendEngine();
  engine.addDataPoint({ metric: "cost", value: 10, timestamp: 1 });
  engine.addDataPoint({ metric: "cost", value: 20, timestamp: 2 });
  engine.addDataPoint({ metric: "cost", value: 30, timestamp: 3 });
  const trend = engine.getTrend("cost");
  if (trend.direction !== "increasing") throw new Error(`expected increasing, got ${trend.direction}`);
});

assert("getTrend detects decreasing", () => {
  const engine = taeMod.createTrendEngine();
  engine.addDataPoint({ metric: "errors", value: 30, timestamp: 1 });
  engine.addDataPoint({ metric: "errors", value: 20, timestamp: 2 });
  engine.addDataPoint({ metric: "errors", value: 10, timestamp: 3 });
  const trend = engine.getTrend("errors");
  if (trend.direction !== "decreasing") throw new Error(`expected decreasing, got ${trend.direction}`);
});

assert("detectAnomalies finds outliers", () => {
  const engine = taeMod.createTrendEngine();
  for (let i = 0; i < 10; i++) {
    engine.addDataPoint({ metric: "latency", value: 100 + (i % 3), timestamp: i });
  }
  // Add an outlier
  engine.addDataPoint({ metric: "latency", value: 500, timestamp: 10 });
  const anomalies = engine.detectAnomalies("latency");
  if (anomalies.length === 0) throw new Error("should detect outlier");
});

assert("getTrend returns stable for flat data", () => {
  const engine = taeMod.createTrendEngine();
  engine.addDataPoint({ metric: "x", value: 50, timestamp: 1 });
  engine.addDataPoint({ metric: "x", value: 50, timestamp: 2 });
  engine.addDataPoint({ metric: "x", value: 50, timestamp: 3 });
  const trend = engine.getTrend("x");
  if (trend.direction !== "stable") throw new Error(`expected stable, got ${trend.direction}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
