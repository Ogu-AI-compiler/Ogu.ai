/**
 * Slice 101 — Wave Executor + DAG Runner
 *
 * Wave executor: execute tasks in parallel waves from a DAG.
 * DAG runner: orchestrate full DAG execution with status tracking.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 101 — Wave Executor + DAG Runner\x1b[0m\n");

// ── Part 1: Wave Executor ──────────────────────────────

console.log("\x1b[36m  Part 1: Wave Executor\x1b[0m");

const weLib = join(process.cwd(), "tools/ogu/commands/lib/wave-executor.mjs");
assert("wave-executor.mjs exists", () => {
  if (!existsSync(weLib)) throw new Error("file missing");
});

const weMod = await import(weLib);

assert("createWaveExecutor returns executor", () => {
  if (typeof weMod.createWaveExecutor !== "function") throw new Error("missing");
  const we = weMod.createWaveExecutor();
  if (typeof we.addTask !== "function") throw new Error("missing addTask");
  if (typeof we.execute !== "function") throw new Error("missing execute");
});

assert("addTask registers tasks with dependencies", () => {
  const we = weMod.createWaveExecutor();
  we.addTask("a", { run: async () => "a-done", deps: [] });
  we.addTask("b", { run: async () => "b-done", deps: ["a"] });
  we.addTask("c", { run: async () => "c-done", deps: ["a"] });
  const tasks = we.listTasks();
  if (tasks.length !== 3) throw new Error(`expected 3, got ${tasks.length}`);
});

assert("execute runs tasks in correct wave order", async () => {
  const order = [];
  const we = weMod.createWaveExecutor();
  we.addTask("a", { run: async () => { order.push("a"); return "a"; }, deps: [] });
  we.addTask("b", { run: async () => { order.push("b"); return "b"; }, deps: ["a"] });
  we.addTask("c", { run: async () => { order.push("c"); return "c"; }, deps: ["a"] });
  we.addTask("d", { run: async () => { order.push("d"); return "d"; }, deps: ["b", "c"] });
  const result = await we.execute();
  // a must be first
  if (order[0] !== "a") throw new Error(`first should be a, got ${order[0]}`);
  // d must be last
  if (order[order.length - 1] !== "d") throw new Error(`last should be d, got ${order[order.length - 1]}`);
  if (result.status !== "completed") throw new Error(`expected completed, got ${result.status}`);
  if (result.waves.length < 2) throw new Error(`expected at least 2 waves`);
});

assert("execute returns results per task", async () => {
  const we = weMod.createWaveExecutor();
  we.addTask("x", { run: async () => 42, deps: [] });
  we.addTask("y", { run: async () => 99, deps: ["x"] });
  const result = await we.execute();
  if (result.results.x !== 42) throw new Error(`expected 42, got ${result.results.x}`);
  if (result.results.y !== 99) throw new Error(`expected 99, got ${result.results.y}`);
});

assert("execute handles task failure", async () => {
  const we = weMod.createWaveExecutor();
  we.addTask("ok", { run: async () => "fine", deps: [] });
  we.addTask("fail", { run: async () => { throw new Error("boom"); }, deps: ["ok"] });
  const result = await we.execute();
  if (result.status !== "failed") throw new Error(`expected failed, got ${result.status}`);
  if (!result.errors.fail) throw new Error("missing error for fail task");
});

// ── Part 2: DAG Runner ──────────────────────────────

console.log("\n\x1b[36m  Part 2: DAG Runner\x1b[0m");

const drLib = join(process.cwd(), "tools/ogu/commands/lib/dag-runner.mjs");
assert("dag-runner.mjs exists", () => {
  if (!existsSync(drLib)) throw new Error("file missing");
});

const drMod = await import(drLib);

assert("createDAGRunner returns runner", () => {
  if (typeof drMod.createDAGRunner !== "function") throw new Error("missing");
  const dr = drMod.createDAGRunner();
  if (typeof dr.loadPlan !== "function") throw new Error("missing loadPlan");
  if (typeof dr.run !== "function") throw new Error("missing run");
  if (typeof dr.getStatus !== "function") throw new Error("missing getStatus");
});

assert("loadPlan accepts Plan.json-like structure", () => {
  const dr = drMod.createDAGRunner();
  dr.loadPlan({
    tasks: [
      { id: "t1", deps: [], run: async () => "done1" },
      { id: "t2", deps: ["t1"], run: async () => "done2" },
    ]
  });
  const status = dr.getStatus();
  if (status.totalTasks !== 2) throw new Error(`expected 2, got ${status.totalTasks}`);
  if (status.state !== "ready") throw new Error(`expected ready, got ${status.state}`);
});

assert("run executes full DAG", async () => {
  const dr = drMod.createDAGRunner();
  const log = [];
  dr.loadPlan({
    tasks: [
      { id: "compile", deps: [], run: async () => { log.push("compile"); return "compiled"; } },
      { id: "test", deps: ["compile"], run: async () => { log.push("test"); return "tested"; } },
      { id: "deploy", deps: ["test"], run: async () => { log.push("deploy"); return "deployed"; } },
    ]
  });
  const result = await dr.run();
  if (result.state !== "completed") throw new Error(`expected completed, got ${result.state}`);
  if (log[0] !== "compile") throw new Error(`first should be compile`);
  if (log[2] !== "deploy") throw new Error(`last should be deploy`);
});

assert("run tracks per-task timing", async () => {
  const dr = drMod.createDAGRunner();
  dr.loadPlan({
    tasks: [
      { id: "fast", deps: [], run: async () => "fast" },
    ]
  });
  const result = await dr.run();
  if (typeof result.taskTimings.fast !== "number") throw new Error("missing timing");
  if (result.taskTimings.fast < 0) throw new Error("negative timing");
});

assert("run handles mid-DAG failure with partial results", async () => {
  const dr = drMod.createDAGRunner();
  dr.loadPlan({
    tasks: [
      { id: "a", deps: [], run: async () => "ok" },
      { id: "b", deps: ["a"], run: async () => { throw new Error("fail"); } },
      { id: "c", deps: ["b"], run: async () => "skipped" },
    ]
  });
  const result = await dr.run();
  if (result.state !== "failed") throw new Error(`expected failed, got ${result.state}`);
  if (result.completed.indexOf("a") === -1) throw new Error("a should be completed");
  if (result.failed.indexOf("b") === -1) throw new Error("b should be failed");
  if (result.skipped.indexOf("c") === -1) throw new Error("c should be skipped");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
