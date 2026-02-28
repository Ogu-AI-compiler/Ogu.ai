/**
 * Slice 189 — LRU Cache + Eviction Policy
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 189 — LRU Cache + Eviction Policy\x1b[0m\n");

console.log("\x1b[36m  Part 1: LRU Cache\x1b[0m");
const lcLib = join(process.cwd(), "tools/ogu/commands/lib/lru-cache.mjs");
assert("lru-cache.mjs exists", () => { if (!existsSync(lcLib)) throw new Error("missing"); });
const lcMod = await import(lcLib);
assert("createLRUCache works", () => {
  const c = lcMod.createLRUCache(3);
  c.set("a", 1); c.set("b", 2); c.set("c", 3);
  if (c.get("a") !== 1) throw new Error("should get a");
  c.set("d", 4); // evicts b (a was recently accessed)
  if (c.get("b") !== undefined) throw new Error("b should be evicted");
});
assert("get returns undefined for missing", () => {
  const c = lcMod.createLRUCache(2);
  if (c.get("x") !== undefined) throw new Error("should be undefined");
});
assert("size tracks count", () => {
  const c = lcMod.createLRUCache(10);
  c.set("a", 1); c.set("b", 2);
  if (c.size() !== 2) throw new Error(`expected 2, got ${c.size()}`);
});

console.log("\n\x1b[36m  Part 2: Eviction Policy\x1b[0m");
const epLib = join(process.cwd(), "tools/ogu/commands/lib/eviction-policy.mjs");
assert("eviction-policy.mjs exists", () => { if (!existsSync(epLib)) throw new Error("missing"); });
const epMod = await import(epLib);
assert("createEvictionPolicy FIFO works", () => {
  const p = epMod.createEvictionPolicy("fifo");
  p.track("a"); p.track("b"); p.track("c");
  if (p.evict() !== "a") throw new Error("FIFO should evict a");
});
assert("createEvictionPolicy LRU works", () => {
  const p = epMod.createEvictionPolicy("lru");
  p.track("a"); p.track("b"); p.track("c");
  p.access("a"); // a is now most recently used
  if (p.evict() !== "b") throw new Error("LRU should evict b");
});
assert("evict from empty returns null", () => {
  const p = epMod.createEvictionPolicy("fifo");
  if (p.evict() !== null) throw new Error("should return null");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
