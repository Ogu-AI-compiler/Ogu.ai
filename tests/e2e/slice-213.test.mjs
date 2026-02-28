/**
 * Slice 213 — Hash Table Open Addressing + Hash Table Chaining
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 213 — Hash Table Open Addressing + Hash Table Chaining\x1b[0m\n");

console.log("\x1b[36m  Part 1: Hash Table Open Addressing\x1b[0m");
const hoLib = join(process.cwd(), "tools/ogu/commands/lib/hash-table-open.mjs");
assert("hash-table-open.mjs exists", () => { if (!existsSync(hoLib)) throw new Error("missing"); });
const hoMod = await import(hoLib);
assert("put and get", () => {
  const ht = hoMod.createHashTableOpen(16);
  ht.put("name", "Alice");
  if (ht.get("name") !== "Alice") throw new Error("expected Alice");
});
assert("handles collisions", () => {
  const ht = hoMod.createHashTableOpen(4);
  for (let i = 0; i < 4; i++) ht.put(`k${i}`, i);
  for (let i = 0; i < 4; i++) {
    if (ht.get(`k${i}`) !== i) throw new Error(`expected ${i}`);
  }
});
assert("delete works", () => {
  const ht = hoMod.createHashTableOpen(8);
  ht.put("x", 1); ht.delete("x");
  if (ht.get("x") !== undefined) throw new Error("should be undefined");
});

console.log("\n\x1b[36m  Part 2: Hash Table Chaining\x1b[0m");
const hcLib = join(process.cwd(), "tools/ogu/commands/lib/hash-table-chained.mjs");
assert("hash-table-chained.mjs exists", () => { if (!existsSync(hcLib)) throw new Error("missing"); });
const hcMod = await import(hcLib);
assert("put and get", () => {
  const ht = hcMod.createHashTableChained(8);
  ht.put("age", 30);
  if (ht.get("age") !== 30) throw new Error("expected 30");
});
assert("handles many items", () => {
  const ht = hcMod.createHashTableChained(4);
  for (let i = 0; i < 20; i++) ht.put(`key${i}`, i);
  for (let i = 0; i < 20; i++) {
    if (ht.get(`key${i}`) !== i) throw new Error(`wrong value for key${i}`);
  }
});
assert("size tracks count", () => {
  const ht = hcMod.createHashTableChained(8);
  ht.put("a", 1); ht.put("b", 2);
  if (ht.size() !== 2) throw new Error("expected 2");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
