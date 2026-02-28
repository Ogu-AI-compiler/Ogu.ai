/**
 * Slice 124 — Observability Pipeline + Drift Detector Integration
 *
 * Observability pipeline: unified observability with metrics/logs/traces.
 * Drift detector integration: detect drift across spec/code/contracts/design.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 124 — Observability Pipeline + Drift Detector Integration\x1b[0m\n");

// ── Part 1: Observability Pipeline ──────────────────────────────

console.log("\x1b[36m  Part 1: Observability Pipeline\x1b[0m");

const opLib = join(process.cwd(), "tools/ogu/commands/lib/observability-pipeline.mjs");
assert("observability-pipeline.mjs exists", () => {
  if (!existsSync(opLib)) throw new Error("file missing");
});

const opMod = await import(opLib);

assert("createObservabilityPipeline returns pipeline", () => {
  if (typeof opMod.createObservabilityPipeline !== "function") throw new Error("missing");
  const op = opMod.createObservabilityPipeline();
  if (typeof op.addSink !== "function") throw new Error("missing addSink");
  if (typeof op.emit !== "function") throw new Error("missing emit");
  if (typeof op.query !== "function") throw new Error("missing query");
});

assert("emit pushes events through pipeline", () => {
  const captured = [];
  const op = opMod.createObservabilityPipeline();
  op.addSink("test", (event) => captured.push(event));
  op.emit({ type: "metric", name: "tokens_used", value: 500, agentId: "dev" });
  op.emit({ type: "log", level: "info", message: "Task started", agentId: "dev" });
  if (captured.length !== 2) throw new Error(`expected 2, got ${captured.length}`);
});

assert("query filters events by type", () => {
  const op = opMod.createObservabilityPipeline();
  op.emit({ type: "metric", name: "tokens", value: 100 });
  op.emit({ type: "log", level: "error", message: "fail" });
  op.emit({ type: "metric", name: "latency", value: 200 });
  const metrics = op.query({ type: "metric" });
  if (metrics.length !== 2) throw new Error(`expected 2, got ${metrics.length}`);
});

assert("getStats returns pipeline statistics", () => {
  const op = opMod.createObservabilityPipeline();
  op.emit({ type: "metric", name: "a", value: 1 });
  op.emit({ type: "log", level: "info", message: "b" });
  const stats = op.getStats();
  if (stats.totalEvents !== 2) throw new Error(`expected 2, got ${stats.totalEvents}`);
  if (stats.byType.metric !== 1) throw new Error("wrong metric count");
});

// ── Part 2: Drift Detector Integration ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Drift Detector Integration\x1b[0m");

const ddLib = join(process.cwd(), "tools/ogu/commands/lib/drift-detector-integration.mjs");
assert("drift-detector-integration.mjs exists", () => {
  if (!existsSync(ddLib)) throw new Error("file missing");
});

const ddMod = await import(ddLib);

assert("createDriftDetector returns detector", () => {
  if (typeof ddMod.createDriftDetector !== "function") throw new Error("missing");
  const dd = ddMod.createDriftDetector();
  if (typeof dd.addSource !== "function") throw new Error("missing addSource");
  if (typeof dd.detect !== "function") throw new Error("missing detect");
});

assert("addSource registers a drift source", () => {
  const dd = ddMod.createDriftDetector();
  dd.addSource("spec", { hash: "abc123", check: () => ({ drifted: false }) });
  dd.addSource("contracts", { hash: "def456", check: () => ({ drifted: false }) });
  const sources = dd.listSources();
  if (sources.length !== 2) throw new Error(`expected 2, got ${sources.length}`);
});

assert("detect returns drift report", async () => {
  const dd = ddMod.createDriftDetector();
  dd.addSource("spec", { hash: "abc", check: () => ({ drifted: false }) });
  dd.addSource("design", { hash: "xyz", check: () => ({ drifted: true, details: "Colors changed" }) });
  const report = await dd.detect();
  if (report.hasDrift !== true) throw new Error("should detect drift");
  if (report.sources.length !== 2) throw new Error("should report all sources");
  const designDrift = report.sources.find(s => s.name === "design");
  if (!designDrift.drifted) throw new Error("design should be drifted");
});

assert("detect returns clean when no drift", async () => {
  const dd = ddMod.createDriftDetector();
  dd.addSource("spec", { hash: "a", check: () => ({ drifted: false }) });
  dd.addSource("code", { hash: "b", check: () => ({ drifted: false }) });
  const report = await dd.detect();
  if (report.hasDrift !== false) throw new Error("should not have drift");
});

assert("DRIFT_SOURCES lists standard sources", () => {
  if (!Array.isArray(ddMod.DRIFT_SOURCES)) throw new Error("missing");
  const expected = ["spec", "contracts", "ir", "design"];
  for (const s of expected) {
    if (!ddMod.DRIFT_SOURCES.includes(s)) throw new Error(`missing ${s}`);
  }
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
