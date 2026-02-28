/**
 * Slice 168 — Delayed Executor + Task Scheduler Engine
 *
 * Delayed Executor: schedule tasks with delays and cancellation.
 * Task Scheduler Engine: manage task queues with priorities and execution.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 168 — Delayed Executor + Task Scheduler Engine\x1b[0m\n");

// ── Part 1: Delayed Executor ──────────────────────────────

console.log("\x1b[36m  Part 1: Delayed Executor\x1b[0m");

const deLib = join(process.cwd(), "tools/ogu/commands/lib/delayed-executor.mjs");
assert("delayed-executor.mjs exists", () => {
  if (!existsSync(deLib)) throw new Error("file missing");
});

const deMod = await import(deLib);

assert("createDelayedExecutor returns executor", () => {
  if (typeof deMod.createDelayedExecutor !== "function") throw new Error("missing");
  const de = deMod.createDelayedExecutor();
  if (typeof de.schedule !== "function") throw new Error("missing schedule");
  if (typeof de.cancel !== "function") throw new Error("missing cancel");
  if (typeof de.getPending !== "function") throw new Error("missing getPending");
});

assert("schedule adds task with delay", () => {
  const de = deMod.createDelayedExecutor();
  const id = de.schedule({ task: "send-email", delayMs: 5000 });
  if (!id) throw new Error("should return task id");
  const pending = de.getPending();
  if (pending.length !== 1) throw new Error(`expected 1, got ${pending.length}`);
});

assert("cancel removes pending task", () => {
  const de = deMod.createDelayedExecutor();
  const id = de.schedule({ task: "cleanup", delayMs: 10000 });
  const cancelled = de.cancel(id);
  if (!cancelled) throw new Error("should return true");
  if (de.getPending().length !== 0) throw new Error("should be empty");
});

assert("cancel returns false for unknown", () => {
  const de = deMod.createDelayedExecutor();
  if (de.cancel("unknown-id")) throw new Error("should return false");
});

assert("executeReady runs due tasks", () => {
  const de = deMod.createDelayedExecutor();
  const results = [];
  de.schedule({ task: "a", delayMs: 0, handler: () => results.push("a") });
  de.schedule({ task: "b", delayMs: 999999, handler: () => results.push("b") });
  de.executeReady();
  if (results.length !== 1) throw new Error(`expected 1, got ${results.length}`);
  if (results[0] !== "a") throw new Error("should execute 'a'");
});

// ── Part 2: Task Scheduler Engine ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Task Scheduler Engine\x1b[0m");

const tseLib = join(process.cwd(), "tools/ogu/commands/lib/task-scheduler-engine.mjs");
assert("task-scheduler-engine.mjs exists", () => {
  if (!existsSync(tseLib)) throw new Error("file missing");
});

const tseMod = await import(tseLib);

assert("createTaskSchedulerEngine returns engine", () => {
  if (typeof tseMod.createTaskSchedulerEngine !== "function") throw new Error("missing");
  const eng = tseMod.createTaskSchedulerEngine();
  if (typeof eng.add !== "function") throw new Error("missing add");
  if (typeof eng.next !== "function") throw new Error("missing next");
  if (typeof eng.getQueue !== "function") throw new Error("missing getQueue");
});

assert("add and next returns highest priority", () => {
  const eng = tseMod.createTaskSchedulerEngine();
  eng.add({ id: "low", priority: 1 });
  eng.add({ id: "high", priority: 10 });
  eng.add({ id: "mid", priority: 5 });
  const task = eng.next();
  if (task.id !== "high") throw new Error(`expected high, got ${task.id}`);
});

assert("next removes task from queue", () => {
  const eng = tseMod.createTaskSchedulerEngine();
  eng.add({ id: "a", priority: 1 });
  eng.next();
  if (eng.getQueue().length !== 0) throw new Error("should be empty");
});

assert("next returns null when empty", () => {
  const eng = tseMod.createTaskSchedulerEngine();
  if (eng.next() !== null) throw new Error("should return null");
});

assert("getStats returns queue size", () => {
  const eng = tseMod.createTaskSchedulerEngine();
  eng.add({ id: "x", priority: 1 });
  eng.add({ id: "y", priority: 2 });
  const stats = eng.getStats();
  if (stats.queued !== 2) throw new Error(`expected 2, got ${stats.queued}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
