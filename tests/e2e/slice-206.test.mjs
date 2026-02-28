/**
 * Slice 206 — Coroutine Scheduler + Fiber Manager
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 206 — Coroutine Scheduler + Fiber Manager\x1b[0m\n");

console.log("\x1b[36m  Part 1: Coroutine Scheduler\x1b[0m");
const csLib = join(process.cwd(), "tools/ogu/commands/lib/coroutine-scheduler.mjs");
assert("coroutine-scheduler.mjs exists", () => { if (!existsSync(csLib)) throw new Error("missing"); });
const csMod = await import(csLib);
assert("schedule and run coroutines", () => {
  const sched = csMod.createCoroutineScheduler();
  const results = [];
  sched.schedule(function*() { results.push("a1"); yield; results.push("a2"); });
  sched.schedule(function*() { results.push("b1"); yield; results.push("b2"); });
  sched.runAll();
  if (results.length !== 4) throw new Error(`expected 4, got ${results.length}`);
});
assert("round-robin execution", () => {
  const sched = csMod.createCoroutineScheduler();
  const order = [];
  sched.schedule(function*() { order.push(1); yield; order.push(3); });
  sched.schedule(function*() { order.push(2); yield; order.push(4); });
  sched.runAll();
  if (order[0] !== 1 || order[1] !== 2) throw new Error("should interleave");
});
assert("getStats returns info", () => {
  const sched = csMod.createCoroutineScheduler();
  sched.schedule(function*() { yield; });
  const stats = sched.getStats();
  if (stats.pending !== 1) throw new Error("expected 1 pending");
});

console.log("\n\x1b[36m  Part 2: Fiber Manager\x1b[0m");
const fmLib = join(process.cwd(), "tools/ogu/commands/lib/fiber-manager.mjs");
assert("fiber-manager.mjs exists", () => { if (!existsSync(fmLib)) throw new Error("missing"); });
const fmMod = await import(fmLib);
assert("create and run fiber", () => {
  const fm = fmMod.createFiberManager();
  let ran = false;
  fm.create("f1", () => { ran = true; });
  fm.runAll();
  if (!ran) throw new Error("fiber should have run");
});
assert("list fibers", () => {
  const fm = fmMod.createFiberManager();
  fm.create("a", () => {});
  fm.create("b", () => {});
  if (fm.list().length !== 2) throw new Error("expected 2");
});
assert("getStats returns fiber count", () => {
  const fm = fmMod.createFiberManager();
  fm.create("x", () => {});
  if (fm.getStats().total !== 1) throw new Error("expected 1");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
