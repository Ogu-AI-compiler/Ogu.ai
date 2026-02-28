/**
 * Slice 96 — Task Splitter + Work Distribution
 *
 * Task splitter: split large tasks into subtasks.
 * Work distribution: assign work to available agents.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 96 — Task Splitter + Work Distribution\x1b[0m\n");

// ── Part 1: Task Splitter ──────────────────────────────

console.log("\x1b[36m  Part 1: Task Splitter\x1b[0m");

const tsLib = join(process.cwd(), "tools/ogu/commands/lib/task-splitter.mjs");
assert("task-splitter.mjs exists", () => {
  if (!existsSync(tsLib)) throw new Error("file missing");
});

const tsMod = await import(tsLib);

assert("splitTask divides into subtasks", () => {
  if (typeof tsMod.splitTask !== "function") throw new Error("missing");
  const subtasks = tsMod.splitTask({
    id: "big-task",
    items: ["a", "b", "c", "d", "e", "f"],
    maxPerSubtask: 2,
  });
  if (!Array.isArray(subtasks)) throw new Error("should return array");
  if (subtasks.length !== 3) throw new Error(`expected 3, got ${subtasks.length}`);
  if (subtasks[0].items.length !== 2) throw new Error("each should have 2 items");
});

assert("subtasks have parent reference", () => {
  const subtasks = tsMod.splitTask({
    id: "parent-1",
    items: ["a", "b", "c"],
    maxPerSubtask: 2,
  });
  for (const st of subtasks) {
    if (st.parentId !== "parent-1") throw new Error("should reference parent");
  }
});

assert("single item does not split", () => {
  const subtasks = tsMod.splitTask({ id: "small", items: ["a"], maxPerSubtask: 10 });
  if (subtasks.length !== 1) throw new Error("should not split single item");
});

assert("mergeResults combines subtask results", () => {
  if (typeof tsMod.mergeResults !== "function") throw new Error("missing");
  const results = [
    { subtaskId: "s1", output: [1, 2] },
    { subtaskId: "s2", output: [3, 4] },
  ];
  const merged = tsMod.mergeResults(results);
  if (!Array.isArray(merged.output)) throw new Error("should merge outputs");
  if (merged.output.length !== 4) throw new Error(`expected 4, got ${merged.output.length}`);
});

// ── Part 2: Work Distribution ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Work Distribution\x1b[0m");

const wdLib = join(process.cwd(), "tools/ogu/commands/lib/work-distribution.mjs");
assert("work-distribution.mjs exists", () => {
  if (!existsSync(wdLib)) throw new Error("file missing");
});

const wdMod = await import(wdLib);

assert("createWorkDistributor returns distributor", () => {
  if (typeof wdMod.createWorkDistributor !== "function") throw new Error("missing");
  const wd = wdMod.createWorkDistributor();
  if (typeof wd.addAgent !== "function") throw new Error("missing addAgent");
  if (typeof wd.assign !== "function") throw new Error("missing assign");
});

assert("assign distributes work to agents", () => {
  const wd = wdMod.createWorkDistributor();
  wd.addAgent({ id: "a1", capabilities: ["build", "test"] });
  wd.addAgent({ id: "a2", capabilities: ["review"] });
  const assignment = wd.assign({ task: "build", requiredCapability: "build" });
  if (!assignment) throw new Error("should assign to agent");
  if (assignment.agentId !== "a1") throw new Error("should assign to capable agent");
});

assert("assign returns null when no capable agent", () => {
  const wd = wdMod.createWorkDistributor();
  wd.addAgent({ id: "a1", capabilities: ["test"] });
  const assignment = wd.assign({ task: "deploy", requiredCapability: "deploy" });
  if (assignment !== null) throw new Error("should return null when no match");
});

assert("getAssignments returns current workload", () => {
  const wd = wdMod.createWorkDistributor();
  wd.addAgent({ id: "a1", capabilities: ["build"] });
  wd.assign({ task: "build-1", requiredCapability: "build" });
  const assignments = wd.getAssignments();
  if (!Array.isArray(assignments)) throw new Error("should return array");
  if (assignments.length !== 1) throw new Error(`expected 1, got ${assignments.length}`);
});

assert("complete marks assignment done", () => {
  const wd = wdMod.createWorkDistributor();
  wd.addAgent({ id: "a1", capabilities: ["build"] });
  const a = wd.assign({ task: "build-1", requiredCapability: "build" });
  wd.complete(a.assignmentId);
  const active = wd.getAssignments();
  if (active.length !== 0) throw new Error("completed should not appear in active");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
