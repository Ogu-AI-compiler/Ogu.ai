/**
 * Slice 149 — Caching Layer + TTL Store
 *
 * Caching Layer: in-memory cache with LRU eviction.
 * TTL Store: key-value store with time-to-live expiration.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 149 — Caching Layer + TTL Store\x1b[0m\n");

console.log("\x1b[36m  Part 1: Caching Layer\x1b[0m");

const clLib = join(process.cwd(), "tools/ogu/commands/lib/cache-layer.mjs");
assert("cache-layer.mjs exists", () => { if (!existsSync(clLib)) throw new Error("file missing"); });

const clMod = await import(clLib);

assert("createCache returns cache", () => {
  if (typeof clMod.createCache !== "function") throw new Error("missing");
  const cache = clMod.createCache({ maxSize: 100 });
  if (typeof cache.get !== "function") throw new Error("missing get");
  if (typeof cache.set !== "function") throw new Error("missing set");
});

assert("set and get works", () => {
  const cache = clMod.createCache({ maxSize: 10 });
  cache.set("key1", "value1");
  if (cache.get("key1") !== "value1") throw new Error("should return value");
});

assert("get returns undefined for missing key", () => {
  const cache = clMod.createCache({ maxSize: 10 });
  if (cache.get("nope") !== undefined) throw new Error("should be undefined");
});

assert("evicts oldest when full", () => {
  const cache = clMod.createCache({ maxSize: 3 });
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  cache.set("d", 4); // should evict "a"
  if (cache.get("a") !== undefined) throw new Error("a should be evicted");
  if (cache.get("d") !== 4) throw new Error("d should exist");
});

assert("getStats returns hit/miss stats", () => {
  const cache = clMod.createCache({ maxSize: 10 });
  cache.set("x", 1);
  cache.get("x"); // hit
  cache.get("y"); // miss
  const stats = cache.getStats();
  if (stats.hits !== 1) throw new Error(`expected 1 hit, got ${stats.hits}`);
  if (stats.misses !== 1) throw new Error(`expected 1 miss, got ${stats.misses}`);
});

console.log("\n\x1b[36m  Part 2: TTL Store\x1b[0m");

const ttlLib = join(process.cwd(), "tools/ogu/commands/lib/ttl-store.mjs");
assert("ttl-store.mjs exists", () => { if (!existsSync(ttlLib)) throw new Error("file missing"); });

const ttlMod = await import(ttlLib);

assert("createTTLStore returns store", () => {
  if (typeof ttlMod.createTTLStore !== "function") throw new Error("missing");
  const store = ttlMod.createTTLStore();
  if (typeof store.set !== "function") throw new Error("missing set");
  if (typeof store.get !== "function") throw new Error("missing get");
});

assert("set with TTL and get before expiry", () => {
  const store = ttlMod.createTTLStore();
  store.set("key", "value", { ttlMs: 60000 });
  if (store.get("key") !== "value") throw new Error("should return before expiry");
});

assert("get returns undefined after expiry", () => {
  const store = ttlMod.createTTLStore();
  store.set("key", "value", { ttlMs: -1 }); // already expired
  if (store.get("key") !== undefined) throw new Error("should be expired");
});

assert("has returns false for expired", () => {
  const store = ttlMod.createTTLStore();
  store.set("k", "v", { ttlMs: -1 });
  if (store.has("k")) throw new Error("should be expired");
});

assert("size returns active count", () => {
  const store = ttlMod.createTTLStore();
  store.set("a", 1, { ttlMs: 60000 });
  store.set("b", 2, { ttlMs: 60000 });
  store.set("c", 3, { ttlMs: -1 }); // expired
  if (store.size() !== 2) throw new Error(`expected 2, got ${store.size()}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
