/**
 * Slice 112 — Org Health Scorer + Standup Data Aggregator
 *
 * Org health scorer: weighted health score from gates, agents, budget, drift.
 * Standup data aggregator: aggregate agent activity for standup reports.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 112 — Org Health Scorer + Standup Data Aggregator\x1b[0m\n");

// ── Part 1: Org Health Scorer ──────────────────────────────

console.log("\x1b[36m  Part 1: Org Health Scorer\x1b[0m");

const ohLib = join(process.cwd(), "tools/ogu/commands/lib/org-health-scorer.mjs");
assert("org-health-scorer.mjs exists", () => {
  if (!existsSync(ohLib)) throw new Error("file missing");
});

const ohMod = await import(ohLib);

assert("computeOrgHealth returns weighted score", () => {
  if (typeof ohMod.computeOrgHealth !== "function") throw new Error("missing");
  const score = ohMod.computeOrgHealth({
    gatePassRate: 0.95,
    agentPerformance: 0.88,
    budgetAdherence: 0.92,
    driftLevel: 0.05,
  });
  if (typeof score.overall !== "number") throw new Error("missing overall");
  if (score.overall < 0 || score.overall > 1) throw new Error("score out of range");
});

assert("score reflects poor gate pass rate", () => {
  const good = ohMod.computeOrgHealth({ gatePassRate: 0.95, agentPerformance: 0.90, budgetAdherence: 0.95, driftLevel: 0.02 });
  const bad = ohMod.computeOrgHealth({ gatePassRate: 0.30, agentPerformance: 0.90, budgetAdherence: 0.95, driftLevel: 0.02 });
  if (bad.overall >= good.overall) throw new Error("bad gates should lower score");
});

assert("getHealthLevel returns correct level", () => {
  if (typeof ohMod.getHealthLevel !== "function") throw new Error("missing");
  if (ohMod.getHealthLevel(0.9) !== "excellent") throw new Error("0.9 should be excellent");
  if (ohMod.getHealthLevel(0.7) !== "good") throw new Error("0.7 should be good");
  if (ohMod.getHealthLevel(0.5) !== "degraded") throw new Error("0.5 should be degraded");
  if (ohMod.getHealthLevel(0.2) !== "critical") throw new Error("0.2 should be critical");
});

assert("HEALTH_WEIGHTS exported", () => {
  if (!ohMod.HEALTH_WEIGHTS) throw new Error("missing");
  const sum = Object.values(ohMod.HEALTH_WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1.0) > 0.001) throw new Error(`weights should sum to 1.0, got ${sum}`);
});

// ── Part 2: Standup Data Aggregator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Standup Data Aggregator\x1b[0m");

const saLib = join(process.cwd(), "tools/ogu/commands/lib/standup-aggregator.mjs");
assert("standup-aggregator.mjs exists", () => {
  if (!existsSync(saLib)) throw new Error("file missing");
});

const saMod = await import(saLib);

assert("createStandupAggregator returns aggregator", () => {
  if (typeof saMod.createStandupAggregator !== "function") throw new Error("missing");
  const sa = saMod.createStandupAggregator();
  if (typeof sa.addActivity !== "function") throw new Error("missing addActivity");
  if (typeof sa.generateReport !== "function") throw new Error("missing generateReport");
});

assert("addActivity records agent activities", () => {
  const sa = saMod.createStandupAggregator();
  sa.addActivity({ agentId: "backend-dev", type: "task.completed", feature: "auth", detail: "Implemented login API" });
  sa.addActivity({ agentId: "qa", type: "test.passed", feature: "auth", detail: "E2E tests green" });
  sa.addActivity({ agentId: "backend-dev", type: "task.completed", feature: "auth", detail: "Added JWT validation" });
  const activities = sa.getActivities("backend-dev");
  if (activities.length !== 2) throw new Error(`expected 2, got ${activities.length}`);
});

assert("generateReport produces structured standup", () => {
  const sa = saMod.createStandupAggregator();
  sa.addActivity({ agentId: "dev", type: "task.completed", feature: "auth", detail: "Login done" });
  sa.addActivity({ agentId: "dev", type: "task.failed", feature: "pay", detail: "API timeout" });
  sa.addActivity({ agentId: "qa", type: "test.passed", feature: "auth", detail: "All green" });
  const report = sa.generateReport();
  if (!report.byAgent) throw new Error("missing byAgent");
  if (!report.byAgent.dev) throw new Error("missing dev in report");
  if (report.byAgent.dev.completed !== 1) throw new Error("wrong completed count");
  if (report.byAgent.dev.failed !== 1) throw new Error("wrong failed count");
  if (report.summary.totalActivities !== 3) throw new Error("wrong total");
});

assert("generateReport includes feature summary", () => {
  const sa = saMod.createStandupAggregator();
  sa.addActivity({ agentId: "dev", type: "task.completed", feature: "auth", detail: "Done" });
  sa.addActivity({ agentId: "dev", type: "task.completed", feature: "payments", detail: "Done" });
  const report = sa.generateReport();
  if (!report.byFeature) throw new Error("missing byFeature");
  if (!report.byFeature.auth) throw new Error("missing auth feature");
  if (!report.byFeature.payments) throw new Error("missing payments feature");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
