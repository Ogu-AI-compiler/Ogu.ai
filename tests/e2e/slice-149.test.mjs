/**
 * Slice 149 — TTL Store
 *
 * TTL Store: key-value store with time-to-live expiration.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 149 — TTL Store\x1b[0m\n");

console.log("\x1b[36m  Part 1: TTL Store\x1b[0m");

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
