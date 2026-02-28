/**
 * Slice 138 — Task Prioritizer + Deadline Tracker
 *
 * Task Prioritizer: score and rank tasks by urgency, impact, dependencies.
 * Deadline Tracker: track deadlines and alert on approaching/missed ones.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 138 — Task Prioritizer + Deadline Tracker\x1b[0m\n");

// ── Part 1: Task Prioritizer ──────────────────────────────

console.log("\x1b[36m  Part 1: Task Prioritizer\x1b[0m");

const tpLib = join(process.cwd(), "tools/ogu/commands/lib/task-prioritizer.mjs");
assert("task-prioritizer.mjs exists", () => {
  if (!existsSync(tpLib)) throw new Error("file missing");
});

const tpMod = await import(tpLib);

assert("prioritizeTasks returns sorted tasks", () => {
  if (typeof tpMod.prioritizeTasks !== "function") throw new Error("missing");
  const result = tpMod.prioritizeTasks([
    { id: "t1", urgency: 3, impact: 5, blockedBy: [] },
    { id: "t2", urgency: 8, impact: 7, blockedBy: [] },
    { id: "t3", urgency: 5, impact: 3, blockedBy: [] },
  ]);
  if (result[0].id !== "t2") throw new Error("highest priority should be first");
});

assert("blocked tasks rank lower", () => {
  const result = tpMod.prioritizeTasks([
    { id: "t1", urgency: 10, impact: 10, blockedBy: ["t2"] },
    { id: "t2", urgency: 1, impact: 1, blockedBy: [] },
  ]);
  if (result[0].id !== "t2") throw new Error("unblocked should come first");
});

assert("scoreTask returns numeric score", () => {
  if (typeof tpMod.scoreTask !== "function") throw new Error("missing");
  const score = tpMod.scoreTask({ urgency: 5, impact: 5, blockedBy: [] });
  if (typeof score !== "number") throw new Error("should return number");
  if (score <= 0) throw new Error("should be positive");
});

assert("higher urgency+impact = higher score", () => {
  const high = tpMod.scoreTask({ urgency: 9, impact: 9, blockedBy: [] });
  const low = tpMod.scoreTask({ urgency: 1, impact: 1, blockedBy: [] });
  if (high <= low) throw new Error("higher inputs should give higher score");
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
  const tracker = dtMod.createDeadlineTracker();
  if (typeof tracker.addDeadline !== "function") throw new Error("missing addDeadline");
  if (typeof tracker.checkDeadlines !== "function") throw new Error("missing checkDeadlines");
});

assert("addDeadline stores deadline", () => {
  const tracker = dtMod.createDeadlineTracker();
  tracker.addDeadline({ id: "d1", taskId: "t1", dueAt: Date.now() + 60000, label: "Build phase" });
  const all = tracker.listDeadlines();
  if (all.length !== 1) throw new Error(`expected 1, got ${all.length}`);
});

assert("checkDeadlines detects missed deadlines", () => {
  const tracker = dtMod.createDeadlineTracker();
  tracker.addDeadline({ id: "d1", taskId: "t1", dueAt: Date.now() - 10000, label: "Past" });
  tracker.addDeadline({ id: "d2", taskId: "t2", dueAt: Date.now() + 60000, label: "Future" });
  const check = tracker.checkDeadlines();
  if (check.missed.length !== 1) throw new Error(`expected 1 missed, got ${check.missed.length}`);
  if (check.upcoming.length !== 1) throw new Error(`expected 1 upcoming, got ${check.upcoming.length}`);
});

assert("checkDeadlines detects approaching deadlines", () => {
  const tracker = dtMod.createDeadlineTracker();
  tracker.addDeadline({ id: "d1", taskId: "t1", dueAt: Date.now() + 5000, label: "Soon" });
  const check = tracker.checkDeadlines({ warningThreshold: 10000 });
  if (check.approaching.length !== 1) throw new Error("should detect approaching deadline");
});

assert("markComplete removes from active", () => {
  const tracker = dtMod.createDeadlineTracker();
  tracker.addDeadline({ id: "d1", taskId: "t1", dueAt: Date.now() + 60000, label: "Task" });
  tracker.markComplete("d1");
  const check = tracker.checkDeadlines();
  if (check.missed.length !== 0) throw new Error("completed should not be missed");
  if (check.upcoming.length !== 0) throw new Error("completed should not be upcoming");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
