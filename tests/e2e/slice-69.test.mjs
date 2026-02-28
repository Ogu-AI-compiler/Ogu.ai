/**
 * Slice 69 — Command Queue + Priority Scheduler
 *
 * Command queue: ordered command execution with undo/redo support.
 * Priority scheduler: weighted priority task scheduling.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice69-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 69 — Command Queue + Priority Scheduler\x1b[0m\n");

// ── Part 1: Command Queue ──────────────────────────────

console.log("\x1b[36m  Part 1: Command Queue\x1b[0m");

const cmdLib = join(process.cwd(), "tools/ogu/commands/lib/command-queue.mjs");
assert("command-queue.mjs exists", () => {
  if (!existsSync(cmdLib)) throw new Error("file missing");
});

const cmdMod = await import(cmdLib);

assert("createCommandQueue returns queue", () => {
  if (typeof cmdMod.createCommandQueue !== "function") throw new Error("missing");
  const q = cmdMod.createCommandQueue();
  if (typeof q.execute !== "function") throw new Error("missing execute");
  if (typeof q.undo !== "function") throw new Error("missing undo");
  if (typeof q.redo !== "function") throw new Error("missing redo");
  if (typeof q.history !== "function") throw new Error("missing history");
});

assert("execute runs command and records history", () => {
  const q = cmdMod.createCommandQueue();
  let value = 0;
  q.execute({
    do: () => { value = 42; },
    undo: () => { value = 0; },
    description: "set value",
  });
  if (value !== 42) throw new Error("should execute do");
  if (q.history().length !== 1) throw new Error("should record history");
});

assert("undo reverses last command", () => {
  const q = cmdMod.createCommandQueue();
  let value = 0;
  q.execute({ do: () => { value = 10; }, undo: () => { value = 0; } });
  q.undo();
  if (value !== 0) throw new Error("should undo");
});

assert("redo re-applies undone command", () => {
  const q = cmdMod.createCommandQueue();
  let value = 0;
  q.execute({ do: () => { value = 10; }, undo: () => { value = 0; } });
  q.undo();
  q.redo();
  if (value !== 10) throw new Error("should redo");
});

assert("canUndo/canRedo report availability", () => {
  const q = cmdMod.createCommandQueue();
  if (typeof q.canUndo !== "function") throw new Error("missing canUndo");
  if (typeof q.canRedo !== "function") throw new Error("missing canRedo");
  if (q.canUndo()) throw new Error("should not be able to undo initially");
  q.execute({ do: () => {}, undo: () => {} });
  if (!q.canUndo()) throw new Error("should be able to undo");
  q.undo();
  if (!q.canRedo()) throw new Error("should be able to redo");
});

// ── Part 2: Priority Scheduler ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Priority Scheduler\x1b[0m");

const prioLib = join(process.cwd(), "tools/ogu/commands/lib/priority-scheduler.mjs");
assert("priority-scheduler.mjs exists", () => {
  if (!existsSync(prioLib)) throw new Error("file missing");
});

const prioMod = await import(prioLib);

assert("createPriorityScheduler returns scheduler", () => {
  if (typeof prioMod.createPriorityScheduler !== "function") throw new Error("missing");
  const s = prioMod.createPriorityScheduler();
  if (typeof s.enqueue !== "function") throw new Error("missing enqueue");
  if (typeof s.dequeue !== "function") throw new Error("missing dequeue");
  if (typeof s.peek !== "function") throw new Error("missing peek");
  if (typeof s.size !== "function") throw new Error("missing size");
});

assert("dequeue returns highest priority first", () => {
  const s = prioMod.createPriorityScheduler();
  s.enqueue({ id: "low", priority: 1, task: "cleanup" });
  s.enqueue({ id: "high", priority: 10, task: "deploy" });
  s.enqueue({ id: "med", priority: 5, task: "build" });
  const first = s.dequeue();
  if (first.id !== "high") throw new Error(`expected high, got ${first.id}`);
  const second = s.dequeue();
  if (second.id !== "med") throw new Error(`expected med, got ${second.id}`);
});

assert("peek shows next without removing", () => {
  const s = prioMod.createPriorityScheduler();
  s.enqueue({ id: "a", priority: 3, task: "x" });
  const peeked = s.peek();
  if (peeked.id !== "a") throw new Error("peek should show next");
  if (s.size() !== 1) throw new Error("peek should not remove");
});

assert("size returns current queue length", () => {
  const s = prioMod.createPriorityScheduler();
  s.enqueue({ id: "1", priority: 1, task: "a" });
  s.enqueue({ id: "2", priority: 2, task: "b" });
  if (s.size() !== 2) throw new Error(`expected 2, got ${s.size()}`);
  s.dequeue();
  if (s.size() !== 1) throw new Error(`expected 1 after dequeue, got ${s.size()}`);
});

assert("PRIORITY_LEVELS defines standard levels", () => {
  if (!prioMod.PRIORITY_LEVELS) throw new Error("missing");
  if (typeof prioMod.PRIORITY_LEVELS.critical !== "number") throw new Error("missing critical");
  if (typeof prioMod.PRIORITY_LEVELS.low !== "number") throw new Error("missing low");
  if (prioMod.PRIORITY_LEVELS.critical <= prioMod.PRIORITY_LEVELS.low) {
    throw new Error("critical should be higher than low");
  }
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
