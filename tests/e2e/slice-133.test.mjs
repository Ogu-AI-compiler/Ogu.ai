/**
 * Slice 133 — Agent Performance Loop + Trend Analysis Engine
 *
 * Agent Performance Loop: closed-loop tracking and model selection improvement.
 * Trend Analysis Engine: org-level trend analysis and anomaly detection.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 133 — Agent Performance Loop + Trend Analysis Engine\x1b[0m\n");

// ── Part 1: Agent Performance Loop ──────────────────────────────

console.log("\x1b[36m  Part 1: Agent Performance Loop\x1b[0m");

const aplLib = join(process.cwd(), "tools/ogu/commands/lib/agent-performance-loop.mjs");
assert("agent-performance-loop.mjs exists", () => {
  if (!existsSync(aplLib)) throw new Error("file missing");
});

const aplMod = await import(aplLib);

assert("createPerformanceLoop returns loop", () => {
  if (typeof aplMod.createPerformanceLoop !== "function") throw new Error("missing");
  const loop = aplMod.createPerformanceLoop();
  if (typeof loop.recordOutcome !== "function") throw new Error("missing recordOutcome");
  if (typeof loop.getStats !== "function") throw new Error("missing getStats");
  if (typeof loop.recommend !== "function") throw new Error("missing recommend");
});

assert("recordOutcome tracks success/failure", () => {
  const loop = aplMod.createPerformanceLoop();
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "sonnet", success: true, duration: 5000, cost: 0.03 });
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "sonnet", success: false, duration: 8000, cost: 0.05 });
  const stats = loop.getStats("dev");
  if (stats.total !== 2) throw new Error(`expected 2 total, got ${stats.total}`);
  if (stats.successes !== 1) throw new Error(`expected 1 success, got ${stats.successes}`);
});

assert("recommend suggests best model for task type", () => {
  const loop = aplMod.createPerformanceLoop();
  // Sonnet: 3 successes, 1 failure
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "sonnet", success: true, duration: 5000, cost: 0.03 });
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "sonnet", success: true, duration: 4000, cost: 0.03 });
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "sonnet", success: true, duration: 6000, cost: 0.03 });
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "sonnet", success: false, duration: 9000, cost: 0.05 });
  // Haiku: 1 success, 3 failures
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "haiku", success: true, duration: 2000, cost: 0.01 });
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "haiku", success: false, duration: 3000, cost: 0.01 });
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "haiku", success: false, duration: 4000, cost: 0.01 });
  loop.recordOutcome({ agentId: "dev", taskType: "build", model: "haiku", success: false, duration: 3000, cost: 0.01 });
  const rec = loop.recommend({ taskType: "build" });
  if (rec.model !== "sonnet") throw new Error(`expected sonnet, got ${rec.model}`);
});

assert("getStats returns per-agent breakdown", () => {
  const loop = aplMod.createPerformanceLoop();
  loop.recordOutcome({ agentId: "qa", taskType: "test", model: "haiku", success: true, duration: 1000, cost: 0.005 });
  const stats = loop.getStats("qa");
  if (stats.successRate !== 1) throw new Error("expected 100% success rate");
  if (stats.avgDuration !== 1000) throw new Error(`expected avgDuration 1000, got ${stats.avgDuration}`);
});

// ── Part 2: Trend Analysis Engine ──────────────────────────────

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
