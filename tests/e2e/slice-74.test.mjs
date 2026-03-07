/**
 * Slice 74 — Scheduler WFQ
 *

 * Scheduler WFQ: weighted fair queueing with starvation prevention.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 74 — Scheduler WFQ\x1b[0m\n");

// ── Part 1: Scheduler WFQ ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Scheduler WFQ\x1b[0m");

const wfqLib = join(process.cwd(), "tools/ogu/commands/lib/scheduler-wfq.mjs");
assert("scheduler-wfq.mjs exists", () => {
  if (!existsSync(wfqLib)) throw new Error("file missing");
});

const wfqMod = await import(wfqLib);

assert("createWFQScheduler returns scheduler", () => {
  if (typeof wfqMod.createWFQScheduler !== "function") throw new Error("missing");
  const s = wfqMod.createWFQScheduler();
  if (typeof s.enqueue !== "function") throw new Error("missing enqueue");
  if (typeof s.dequeue !== "function") throw new Error("missing dequeue");
  if (typeof s.size !== "function") throw new Error("missing size");
});

assert("enqueue adds items with weight", () => {
  const s = wfqMod.createWFQScheduler();
  s.enqueue({ id: "a", task: "low" }, { weight: 1 });
  s.enqueue({ id: "b", task: "high" }, { weight: 10 });
  if (s.size() !== 2) throw new Error(`expected 2, got ${s.size()}`);
});

assert("dequeue returns higher-weight items first", () => {
  const s = wfqMod.createWFQScheduler();
  s.enqueue({ id: "low" }, { weight: 1 });
  s.enqueue({ id: "high" }, { weight: 100 });
  s.enqueue({ id: "med" }, { weight: 50 });
  const first = s.dequeue();
  if (first.id !== "high") throw new Error(`expected high first, got ${first.id}`);
});

assert("dequeue returns null when empty", () => {
  const s = wfqMod.createWFQScheduler();
  const item = s.dequeue();
  if (item !== null) throw new Error("should return null");
});

assert("peek shows next item without removing", () => {
  const s = wfqMod.createWFQScheduler();
  s.enqueue({ id: "x" }, { weight: 5 });
  const peeked = s.peek();
  if (!peeked || peeked.id !== "x") throw new Error("peek failed");
  if (s.size() !== 1) throw new Error("peek should not remove");
});

assert("getStats returns queue statistics", () => {
  const s = wfqMod.createWFQScheduler();
  s.enqueue({ id: "a" }, { weight: 10 });
  s.enqueue({ id: "b" }, { weight: 20 });
  const stats = s.getStats();
  if (typeof stats.totalWeight !== "number") throw new Error("missing totalWeight");
  if (stats.count !== 2) throw new Error(`expected count 2, got ${stats.count}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
