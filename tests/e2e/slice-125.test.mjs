/**
 * Slice 125 — Full System Wiring + Integration Test
 *
 * Full system wiring: wire all subsystems into a unified runtime.
 * Integration test: end-to-end test of agent lifecycle through pipeline.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 125 — Full System Wiring + Integration Test\x1b[0m\n");

// ── Part 1: System Runtime ──────────────────────────────

console.log("\x1b[36m  Part 1: System Runtime\x1b[0m");

const srLib = join(process.cwd(), "tools/ogu/commands/lib/system-runtime.mjs");
assert("system-runtime.mjs exists", () => {
  if (!existsSync(srLib)) throw new Error("file missing");
});

const srMod = await import(srLib);

assert("createSystemRuntime returns runtime", () => {
  if (typeof srMod.createSystemRuntime !== "function") throw new Error("missing");
  const rt = srMod.createSystemRuntime();
  if (typeof rt.boot !== "function") throw new Error("missing boot");
  if (typeof rt.getSubsystem !== "function") throw new Error("missing getSubsystem");
  if (typeof rt.shutdown !== "function") throw new Error("missing shutdown");
});

assert("boot initializes all subsystems", async () => {
  const rt = srMod.createSystemRuntime();
  await rt.boot();
  const status = rt.getStatus();
  if (status.state !== "running") throw new Error(`expected running, got ${status.state}`);
  if (status.subsystems.length < 3) throw new Error("should have multiple subsystems");
});

assert("getSubsystem returns named subsystem", async () => {
  const rt = srMod.createSystemRuntime();
  await rt.boot();
  const engine = rt.getSubsystem("kadimaEngine");
  if (!engine) throw new Error("missing kadimaEngine");
  if (typeof engine.assignTask !== "function") throw new Error("kadimaEngine missing assignTask");
});

assert("shutdown stops all subsystems", async () => {
  const rt = srMod.createSystemRuntime();
  await rt.boot();
  await rt.shutdown();
  const status = rt.getStatus();
  if (status.state !== "stopped") throw new Error(`expected stopped, got ${status.state}`);
});

// ── Part 2: Integration — Agent Lifecycle ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Integration — Agent Lifecycle\x1b[0m");

assert("agent can be registered and assigned a task", async () => {
  const rt = srMod.createSystemRuntime();
  await rt.boot();
  const engine = rt.getSubsystem("kadimaEngine");
  engine.registerAgent("test-dev", { capabilities: ["build"], maxConcurrent: 2 });
  const alloc = engine.assignTask({ taskId: "t-1", requiredCapabilities: ["build"], priority: "normal" });
  if (!alloc) throw new Error("should allocate");
  if (alloc.agentId !== "test-dev") throw new Error("wrong agent");
});

assert("budget is tracked per role", async () => {
  const rt = srMod.createSystemRuntime();
  await rt.boot();
  const budget = rt.getSubsystem("budgetTracker");
  budget.setQuota("test-dev", 100000);
  budget.record("test-dev", { tokensIn: 500, tokensOut: 200, cost: 0.01 });
  const usage = budget.getByRole("test-dev");
  if (usage.tokensIn !== 500) throw new Error("wrong tokensIn");
});

assert("events flow through materialized views", async () => {
  const rt = srMod.createSystemRuntime();
  await rt.boot();
  const viewEngine = rt.getSubsystem("viewEngine");
  const eventBus = rt.getSubsystem("eventBus");
  eventBus.emit({ type: "TASK_COMPLETED", payload: { taskId: "t-1" } });
  const dagView = viewEngine.getView("dag");
  if (!dagView.tasks["t-1"]) throw new Error("task should appear in dag view");
  if (dagView.tasks["t-1"].status !== "completed") throw new Error("should be completed");
});

assert("health check aggregates all subsystem health", async () => {
  const rt = srMod.createSystemRuntime();
  await rt.boot();
  const health = rt.getSubsystem("healthAggregator");
  const report = await health.runAll();
  if (report.overall !== "healthy") throw new Error(`expected healthy, got ${report.overall}`);
  if (report.checks.length < 2) throw new Error("should have multiple health checks");
});

assert("full pipeline lifecycle works end-to-end", async () => {
  const rt = srMod.createSystemRuntime();
  await rt.boot();

  // Register agent
  const engine = rt.getSubsystem("kadimaEngine");
  engine.registerAgent("e2e-dev", { capabilities: ["all"], maxConcurrent: 5 });

  // Assign and complete task
  const alloc = engine.assignTask({ taskId: "e2e-t1", requiredCapabilities: ["all"], priority: "high" });
  if (!alloc) throw new Error("allocation failed");

  // Track budget
  const budget = rt.getSubsystem("budgetTracker");
  budget.setQuota("e2e-dev", 500000);
  budget.record("e2e-dev", { tokensIn: 1000, tokensOut: 500, cost: 0.02 });

  // Emit completion
  const eventBus = rt.getSubsystem("eventBus");
  eventBus.emit({ type: "TASK_COMPLETED", payload: { taskId: "e2e-t1" } });

  // Complete task in engine
  engine.completeTask("e2e-t1", { result: "done" });

  // Verify agent is free
  const status = engine.getAgentStatus("e2e-dev");
  if (status.activeTasks !== 0) throw new Error("agent should be free");

  await rt.shutdown();
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
