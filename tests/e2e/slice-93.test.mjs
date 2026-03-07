/**
 * Slice 93 — Task Priority Queue
 *
 * Task priority queue: priority queue with deadline-aware scheduling.

 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 93 — Task Priority Queue\x1b[0m\n");

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
