/**
 * Slice 81 — Load Balancer + Policy Resolver
 *
 * Load balancer: distribute work across runners.
 * Policy resolver: conflict resolution in policy rules.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 81 — Load Balancer + Policy Resolver\x1b[0m\n");

// ── Part 1: Load Balancer ──────────────────────────────

console.log("\x1b[36m  Part 1: Load Balancer\x1b[0m");

const lbLib = join(process.cwd(), "tools/ogu/commands/lib/load-balancer.mjs");
assert("load-balancer.mjs exists", () => {
  if (!existsSync(lbLib)) throw new Error("file missing");
});

const lbMod = await import(lbLib);

assert("createLoadBalancer returns balancer", () => {
  if (typeof lbMod.createLoadBalancer !== "function") throw new Error("missing");
  const lb = lbMod.createLoadBalancer({ algorithm: "round-robin" });
  if (typeof lb.addTarget !== "function") throw new Error("missing addTarget");
  if (typeof lb.next !== "function") throw new Error("missing next");
  if (typeof lb.removeTarget !== "function") throw new Error("missing removeTarget");
});

assert("round-robin distributes evenly", () => {
  const lb = lbMod.createLoadBalancer({ algorithm: "round-robin" });
  lb.addTarget({ id: "r1", host: "a" });
  lb.addTarget({ id: "r2", host: "b" });
  lb.addTarget({ id: "r3", host: "c" });
  const first = lb.next();
  const second = lb.next();
  const third = lb.next();
  const fourth = lb.next();
  if (first.id !== "r1") throw new Error(`expected r1, got ${first.id}`);
  if (second.id !== "r2") throw new Error(`expected r2, got ${second.id}`);
  if (third.id !== "r3") throw new Error(`expected r3, got ${third.id}`);
  if (fourth.id !== "r1") throw new Error(`expected r1 again, got ${fourth.id}`);
});

assert("removeTarget excludes from rotation", () => {
  const lb = lbMod.createLoadBalancer({ algorithm: "round-robin" });
  lb.addTarget({ id: "r1" });
  lb.addTarget({ id: "r2" });
  lb.removeTarget("r1");
  const t = lb.next();
  if (t.id !== "r2") throw new Error(`expected r2, got ${t.id}`);
});

assert("next returns null with no targets", () => {
  const lb = lbMod.createLoadBalancer({ algorithm: "round-robin" });
  if (lb.next() !== null) throw new Error("should return null");
});

assert("getStats returns load info", () => {
  const lb = lbMod.createLoadBalancer({ algorithm: "round-robin" });
  lb.addTarget({ id: "r1" });
  lb.addTarget({ id: "r2" });
  lb.next();
  const stats = lb.getStats();
  if (stats.targetCount !== 2) throw new Error(`expected 2, got ${stats.targetCount}`);
  if (typeof stats.totalRequests !== "number") throw new Error("missing totalRequests");
});

assert("LB_ALGORITHMS exported", () => {
  if (!lbMod.LB_ALGORITHMS) throw new Error("missing");
  if (!Array.isArray(lbMod.LB_ALGORITHMS)) throw new Error("should be array");
  if (!lbMod.LB_ALGORITHMS.includes("round-robin")) throw new Error("missing round-robin");
});

// ── Part 2: Policy Resolver ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Policy Resolver\x1b[0m");

const prLib = join(process.cwd(), "tools/ogu/commands/lib/policy-resolver.mjs");
assert("policy-resolver.mjs exists", () => {
  if (!existsSync(prLib)) throw new Error("file missing");
});

const prMod = await import(prLib);

assert("resolveConflicts returns winning policy", () => {
  if (typeof prMod.resolveConflicts !== "function") throw new Error("missing");
  const policies = [
    { id: "p1", priority: 10, effect: "permit" },
    { id: "p2", priority: 20, effect: "deny" },
  ];
  const result = prMod.resolveConflicts(policies, "highest-priority");
  if (result.effect !== "deny") throw new Error(`expected deny, got ${result.effect}`);
});

assert("deny-overrides strategy works", () => {
  const policies = [
    { id: "p1", effect: "permit" },
    { id: "p2", effect: "deny" },
    { id: "p3", effect: "permit" },
  ];
  const result = prMod.resolveConflicts(policies, "deny-overrides");
  if (result.effect !== "deny") throw new Error("deny should override");
});

assert("first-match strategy returns first", () => {
  const policies = [
    { id: "p1", effect: "permit" },
    { id: "p2", effect: "deny" },
  ];
  const result = prMod.resolveConflicts(policies, "first-match");
  if (result.effect !== "permit") throw new Error("should return first match");
});

assert("RESOLUTION_STRATEGIES exported", () => {
  if (!prMod.RESOLUTION_STRATEGIES) throw new Error("missing");
  if (!Array.isArray(prMod.RESOLUTION_STRATEGIES)) throw new Error("should be array");
  if (prMod.RESOLUTION_STRATEGIES.length < 3) throw new Error("should have at least 3");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
