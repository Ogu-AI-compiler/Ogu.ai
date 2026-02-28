/**
 * Slice 105 — Kadima Engine + Budget Role Tracker
 *
 * Kadima engine: unified orchestration interface wiring agents, worktrees, approvals, budget.
 * Budget role tracker: track spending per role with alert thresholds.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 105 — Kadima Engine + Budget Role Tracker\x1b[0m\n");

// ── Part 1: Kadima Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Kadima Engine\x1b[0m");

const keLib = join(process.cwd(), "tools/ogu/commands/lib/kadima-engine.mjs");
assert("kadima-engine.mjs exists", () => {
  if (!existsSync(keLib)) throw new Error("file missing");
});

const keMod = await import(keLib);

assert("createKadimaEngine returns engine", () => {
  if (typeof keMod.createKadimaEngine !== "function") throw new Error("missing");
  const ke = keMod.createKadimaEngine();
  if (typeof ke.assignTask !== "function") throw new Error("missing assignTask");
  if (typeof ke.getAgentStatus !== "function") throw new Error("missing getAgentStatus");
  if (typeof ke.getAllocations !== "function") throw new Error("missing getAllocations");
});

assert("assignTask allocates task to agent", () => {
  const ke = keMod.createKadimaEngine();
  ke.registerAgent("backend-dev", { capabilities: ["api", "implementation"], maxConcurrent: 3 });
  const allocation = ke.assignTask({
    taskId: "task-1",
    requiredCapabilities: ["api"],
    priority: "high",
  });
  if (!allocation) throw new Error("should return allocation");
  if (allocation.agentId !== "backend-dev") throw new Error(`wrong agent: ${allocation.agentId}`);
  if (allocation.taskId !== "task-1") throw new Error("wrong taskId");
});

assert("assignTask respects max concurrency", () => {
  const ke = keMod.createKadimaEngine();
  ke.registerAgent("dev", { capabilities: ["code"], maxConcurrent: 1 });
  ke.assignTask({ taskId: "t1", requiredCapabilities: ["code"], priority: "normal" });
  const second = ke.assignTask({ taskId: "t2", requiredCapabilities: ["code"], priority: "normal" });
  if (second !== null) throw new Error("should return null when at capacity");
});

assert("completeTask frees agent capacity", () => {
  const ke = keMod.createKadimaEngine();
  ke.registerAgent("dev", { capabilities: ["code"], maxConcurrent: 1 });
  ke.assignTask({ taskId: "t1", requiredCapabilities: ["code"], priority: "normal" });
  ke.completeTask("t1", { result: "done" });
  const next = ke.assignTask({ taskId: "t2", requiredCapabilities: ["code"], priority: "normal" });
  if (!next) throw new Error("should accept after completion");
});

assert("getAgentStatus shows current load", () => {
  const ke = keMod.createKadimaEngine();
  ke.registerAgent("dev", { capabilities: ["code"], maxConcurrent: 3 });
  ke.assignTask({ taskId: "t1", requiredCapabilities: ["code"], priority: "normal" });
  const status = ke.getAgentStatus("dev");
  if (status.activeTasks !== 1) throw new Error(`expected 1, got ${status.activeTasks}`);
  if (status.maxConcurrent !== 3) throw new Error(`expected 3, got ${status.maxConcurrent}`);
});

assert("getAllocations returns all active assignments", () => {
  const ke = keMod.createKadimaEngine();
  ke.registerAgent("a", { capabilities: ["x"], maxConcurrent: 5 });
  ke.assignTask({ taskId: "t1", requiredCapabilities: ["x"], priority: "normal" });
  ke.assignTask({ taskId: "t2", requiredCapabilities: ["x"], priority: "normal" });
  const allocs = ke.getAllocations();
  if (allocs.length !== 2) throw new Error(`expected 2, got ${allocs.length}`);
});

// ── Part 2: Budget Role Tracker ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Budget Role Tracker\x1b[0m");

const brLib = join(process.cwd(), "tools/ogu/commands/lib/budget-role-tracker.mjs");
assert("budget-role-tracker.mjs exists", () => {
  if (!existsSync(brLib)) throw new Error("file missing");
});

const brMod = await import(brLib);

assert("createBudgetRoleTracker returns tracker", () => {
  if (typeof brMod.createBudgetRoleTracker !== "function") throw new Error("missing");
  const br = brMod.createBudgetRoleTracker();
  if (typeof br.record !== "function") throw new Error("missing record");
  if (typeof br.getByRole !== "function") throw new Error("missing getByRole");
  if (typeof br.checkAlerts !== "function") throw new Error("missing checkAlerts");
});

assert("record tracks tokens per role", () => {
  const br = brMod.createBudgetRoleTracker();
  br.setQuota("backend-dev", 100000);
  br.record("backend-dev", { tokensIn: 500, tokensOut: 300, cost: 0.01 });
  br.record("backend-dev", { tokensIn: 200, tokensOut: 100, cost: 0.005 });
  const usage = br.getByRole("backend-dev");
  if (usage.tokensIn !== 700) throw new Error(`expected 700, got ${usage.tokensIn}`);
  if (usage.tokensOut !== 400) throw new Error(`expected 400, got ${usage.tokensOut}`);
  if (usage.tasks !== 2) throw new Error(`expected 2, got ${usage.tasks}`);
});

assert("checkAlerts returns alerts at thresholds", () => {
  const br = brMod.createBudgetRoleTracker({ thresholds: [0.50, 0.75, 0.90] });
  br.setQuota("dev", 1000);
  br.record("dev", { tokensIn: 400, tokensOut: 200, cost: 0 }); // 600 of 1000 = 60%
  const alerts = br.checkAlerts("dev");
  if (alerts.length !== 1) throw new Error(`expected 1 alert (50% threshold), got ${alerts.length}`);
  if (alerts[0].threshold !== 0.50) throw new Error("wrong threshold");
});

assert("checkAlerts returns multiple alerts for higher usage", () => {
  const br = brMod.createBudgetRoleTracker({ thresholds: [0.50, 0.75, 0.90] });
  br.setQuota("dev", 1000);
  br.record("dev", { tokensIn: 500, tokensOut: 400, cost: 0 }); // 900 of 1000 = 90%
  const alerts = br.checkAlerts("dev");
  if (alerts.length !== 3) throw new Error(`expected 3 alerts, got ${alerts.length}`);
});

assert("reset clears usage for a role", () => {
  const br = brMod.createBudgetRoleTracker();
  br.setQuota("dev", 100000);
  br.record("dev", { tokensIn: 500, tokensOut: 300, cost: 0 });
  br.reset("dev");
  const usage = br.getByRole("dev");
  if (usage.tokensIn !== 0) throw new Error("should be 0 after reset");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
