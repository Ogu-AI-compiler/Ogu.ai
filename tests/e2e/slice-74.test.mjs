/**
 * Slice 74 — Failure Strategy + Scheduler WFQ
 *
 * Failure strategy: failure domain definition & resilience mapping.
 * Scheduler WFQ: weighted fair queueing with starvation prevention.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 74 — Failure Strategy + Scheduler WFQ\x1b[0m\n");

// ── Part 1: Failure Strategy ──────────────────────────────

console.log("\x1b[36m  Part 1: Failure Strategy\x1b[0m");

const fsLib = join(process.cwd(), "tools/ogu/commands/lib/failure-strategy.mjs");
assert("failure-strategy.mjs exists", () => {
  if (!existsSync(fsLib)) throw new Error("file missing");
});

const fsMod = await import(fsLib);

assert("createFailureStrategy returns strategy", () => {
  if (typeof fsMod.createFailureStrategy !== "function") throw new Error("missing");
  const fs = fsMod.createFailureStrategy();
  if (typeof fs.defineDomain !== "function") throw new Error("missing defineDomain");
  if (typeof fs.recordFailure !== "function") throw new Error("missing recordFailure");
  if (typeof fs.getRecoveryAction !== "function") throw new Error("missing getRecoveryAction");
});

assert("defineDomain registers failure domain", () => {
  const fs = fsMod.createFailureStrategy();
  fs.defineDomain("llm", { fallback: "retry", maxRetries: 3 });
  fs.defineDomain("database", { fallback: "failover", maxRetries: 1 });
  const domains = fs.listDomains();
  if (domains.length !== 2) throw new Error(`expected 2, got ${domains.length}`);
});

assert("recordFailure tracks failures per domain", () => {
  const fs = fsMod.createFailureStrategy();
  fs.defineDomain("api", { fallback: "retry", maxRetries: 3 });
  fs.recordFailure("api", { error: "timeout" });
  fs.recordFailure("api", { error: "timeout" });
  const status = fs.getDomainStatus("api");
  if (status.failureCount !== 2) throw new Error(`expected 2, got ${status.failureCount}`);
});

assert("getRecoveryAction returns correct action", () => {
  const fs = fsMod.createFailureStrategy();
  fs.defineDomain("llm", { fallback: "retry", maxRetries: 2 });
  fs.recordFailure("llm", { error: "rate_limit" });
  const action = fs.getRecoveryAction("llm");
  if (action.action !== "retry") throw new Error(`expected retry, got ${action.action}`);
});

assert("exhausted retries returns escalate", () => {
  const fs = fsMod.createFailureStrategy();
  fs.defineDomain("api", { fallback: "retry", maxRetries: 2 });
  fs.recordFailure("api", {});
  fs.recordFailure("api", {});
  fs.recordFailure("api", {});
  const action = fs.getRecoveryAction("api");
  if (action.action !== "escalate") throw new Error(`expected escalate, got ${action.action}`);
});

assert("RECOVERY_ACTIONS exported", () => {
  if (!fsMod.RECOVERY_ACTIONS) throw new Error("missing");
  if (!Array.isArray(fsMod.RECOVERY_ACTIONS)) throw new Error("should be array");
  if (!fsMod.RECOVERY_ACTIONS.includes("retry")) throw new Error("missing retry");
  if (!fsMod.RECOVERY_ACTIONS.includes("escalate")) throw new Error("missing escalate");
});

// ── Part 2: Scheduler WFQ ──────────────────────────────

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
