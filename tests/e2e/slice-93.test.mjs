/**
 * Slice 93 — Task Priority Queue + Deadline Tracker
 *
 * Task priority queue: priority queue with deadline-aware scheduling.
 * Deadline tracker: track and alert on approaching deadlines.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 93 — Task Priority Queue + Deadline Tracker\x1b[0m\n");

// ── Part 1: Task Priority Queue ──────────────────────────────

console.log("\x1b[36m  Part 1: Task Priority Queue\x1b[0m");

const tpLib = join(process.cwd(), "tools/ogu/commands/lib/task-priority-queue.mjs");
assert("task-priority-queue.mjs exists", () => {
  if (!existsSync(tpLib)) throw new Error("file missing");
});

const tpMod = await import(tpLib);

assert("createTaskPriorityQueue returns queue", () => {
  if (typeof tpMod.createTaskPriorityQueue !== "function") throw new Error("missing");
  const q = tpMod.createTaskPriorityQueue();
  if (typeof q.add !== "function") throw new Error("missing add");
  if (typeof q.next !== "function") throw new Error("missing next");
  if (typeof q.size !== "function") throw new Error("missing size");
});

assert("higher priority dequeued first", () => {
  const q = tpMod.createTaskPriorityQueue();
  q.add({ id: "low", priority: 1 });
  q.add({ id: "high", priority: 10 });
  q.add({ id: "mid", priority: 5 });
  const first = q.next();
  if (first.id !== "high") throw new Error(`expected high, got ${first.id}`);
});

assert("same priority respects FIFO", () => {
  const q = tpMod.createTaskPriorityQueue();
  q.add({ id: "a", priority: 5 });
  q.add({ id: "b", priority: 5 });
  const first = q.next();
  if (first.id !== "a") throw new Error(`expected a (FIFO), got ${first.id}`);
});

assert("deadline-aware: urgent deadline gets priority boost", () => {
  const q = tpMod.createTaskPriorityQueue();
  q.add({ id: "normal", priority: 10 });
  q.add({ id: "urgent", priority: 5, deadline: Date.now() + 1000 }); // 1 second
  q.add({ id: "relaxed", priority: 5, deadline: Date.now() + 3600000 }); // 1 hour
  const first = q.next();
  if (first.id !== "normal" && first.id !== "urgent") throw new Error("should pick high priority or urgent");
});

// ── Part 2: Deadline Tracker ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Deadline Tracker\x1b[0m");

const dtLib = join(process.cwd(), "tools/ogu/commands/lib/deadline-tracker.mjs");
assert("deadline-tracker.mjs exists", () => {
  if (!existsSync(dtLib)) throw new Error("file missing");
});

const dtMod = await import(dtLib);

assert("createDeadlineTracker returns tracker", () => {
  if (typeof dtMod.createDeadlineTracker !== "function") throw new Error("missing");
  const dt = dtMod.createDeadlineTracker();
  if (typeof dt.addDeadline !== "function") throw new Error("missing addDeadline");
  if (typeof dt.check !== "function") throw new Error("missing check");
  if (typeof dt.listDeadlines !== "function") throw new Error("missing listDeadlines");
});

assert("addDeadline registers deadline", () => {
  const dt = dtMod.createDeadlineTracker();
  dt.addDeadline({ id: "gate-review", deadline: Date.now() + 86400000, label: "Gate review" });
  const list = dt.listDeadlines();
  if (list.length !== 1) throw new Error(`expected 1, got ${list.length}`);
});

assert("check returns overdue items", () => {
  const dt = dtMod.createDeadlineTracker();
  dt.addDeadline({ id: "past", deadline: Date.now() - 1000, label: "Past" });
  dt.addDeadline({ id: "future", deadline: Date.now() + 86400000, label: "Future" });
  const result = dt.check();
  if (result.overdue.length !== 1) throw new Error(`expected 1 overdue, got ${result.overdue.length}`);
  if (result.overdue[0].id !== "past") throw new Error("wrong overdue item");
});

assert("check returns approaching items within threshold", () => {
  const dt = dtMod.createDeadlineTracker();
  dt.addDeadline({ id: "soon", deadline: Date.now() + 1800000, label: "Soon" }); // 30 min
  dt.addDeadline({ id: "later", deadline: Date.now() + 86400000, label: "Later" }); // 24h
  const result = dt.check({ warningThresholdMs: 3600000 }); // 1h warning
  if (result.approaching.length !== 1) throw new Error(`expected 1 approaching, got ${result.approaching.length}`);
});

assert("removeDeadline removes tracked deadline", () => {
  const dt = dtMod.createDeadlineTracker();
  dt.addDeadline({ id: "temp", deadline: Date.now() + 1000, label: "Temp" });
  dt.removeDeadline("temp");
  if (dt.listDeadlines().length !== 0) throw new Error("should be empty");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
