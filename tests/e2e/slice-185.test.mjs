/**
 * Slice 185 — Consistent Hasher + Load Balancer
 *
 * Consistent Hasher: consistent hashing for distributed routing.
 * Load Balancer: round-robin and weighted load balancing.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 185 — Consistent Hasher + Load Balancer\x1b[0m\n");

console.log("\x1b[36m  Part 1: Consistent Hasher\x1b[0m");
const chLib = join(process.cwd(), "tools/ogu/commands/lib/consistent-hasher.mjs");
assert("consistent-hasher.mjs exists", () => { if (!existsSync(chLib)) throw new Error("file missing"); });
const chMod = await import(chLib);

assert("createConsistentHasher returns hasher", () => {
  if (typeof chMod.createConsistentHasher !== "function") throw new Error("missing");
  const ch = chMod.createConsistentHasher({ replicas: 100 });
  if (typeof ch.addNode !== "function") throw new Error("missing addNode");
  if (typeof ch.getNode !== "function") throw new Error("missing getNode");
  if (typeof ch.removeNode !== "function") throw new Error("missing removeNode");
});

assert("getNode returns consistent mapping", () => {
  const ch = chMod.createConsistentHasher({ replicas: 100 });
  ch.addNode("server-1");
  ch.addNode("server-2");
  const node1 = ch.getNode("key-a");
  const node2 = ch.getNode("key-a");
  if (node1 !== node2) throw new Error("same key should map to same node");
});

assert("distribution is roughly even", () => {
  const ch = chMod.createConsistentHasher({ replicas: 100 });
  ch.addNode("a");
  ch.addNode("b");
  const counts = { a: 0, b: 0 };
  for (let i = 0; i < 100; i++) {
    counts[ch.getNode(`key-${i}`)]++;
  }
  if (counts.a < 20 || counts.b < 20) throw new Error(`uneven distribution: a=${counts.a}, b=${counts.b}`);
});

assert("removeNode redistributes", () => {
  const ch = chMod.createConsistentHasher({ replicas: 100 });
  ch.addNode("x");
  ch.addNode("y");
  ch.removeNode("y");
  for (let i = 0; i < 10; i++) {
    if (ch.getNode(`k-${i}`) !== "x") throw new Error("should all go to x");
  }
});

// ── Part 2: Load Balancer (existing API: addTarget({id, ...}), next returns object) ──

console.log("\n\x1b[36m  Part 2: Load Balancer\x1b[0m");
const lbLib = join(process.cwd(), "tools/ogu/commands/lib/load-balancer.mjs");
assert("load-balancer.mjs exists", () => { if (!existsSync(lbLib)) throw new Error("file missing"); });
const lbMod = await import(lbLib);

assert("createLoadBalancer returns balancer", () => {
  if (typeof lbMod.createLoadBalancer !== "function") throw new Error("missing");
  const lb = lbMod.createLoadBalancer({ algorithm: "round-robin" });
  if (typeof lb.addTarget !== "function") throw new Error("missing addTarget");
  if (typeof lb.next !== "function") throw new Error("missing next");
});

assert("round-robin cycles through targets", () => {
  const lb = lbMod.createLoadBalancer({ algorithm: "round-robin" });
  lb.addTarget({ id: "a" });
  lb.addTarget({ id: "b" });
  lb.addTarget({ id: "c" });
  if (lb.next().id !== "a") throw new Error("first should be a");
  if (lb.next().id !== "b") throw new Error("second should be b");
  if (lb.next().id !== "c") throw new Error("third should be c");
  if (lb.next().id !== "a") throw new Error("should cycle back to a");
});

assert("removeTarget removes from rotation", () => {
  const lb = lbMod.createLoadBalancer({ algorithm: "round-robin" });
  lb.addTarget({ id: "a" });
  lb.addTarget({ id: "b" });
  lb.removeTarget("b");
  if (lb.next().id !== "a") throw new Error("should only have a");
  if (lb.next().id !== "a") throw new Error("should cycle back to a");
});

assert("getStats returns target and request counts", () => {
  const lb = lbMod.createLoadBalancer({ algorithm: "round-robin" });
  lb.addTarget({ id: "x" });
  lb.addTarget({ id: "y" });
  lb.next();
  lb.next();
  const stats = lb.getStats();
  if (stats.totalRequests !== 2) throw new Error(`expected 2, got ${stats.totalRequests}`);
  if (stats.targetCount !== 2) throw new Error(`expected 2 targets, got ${stats.targetCount}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
