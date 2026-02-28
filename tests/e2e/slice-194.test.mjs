/**
 * Slice 194 — B-Tree Index + Key-Value Store
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 194 — B-Tree Index + Key-Value Store\x1b[0m\n");

console.log("\x1b[36m  Part 1: B-Tree Index\x1b[0m");
const btLib = join(process.cwd(), "tools/ogu/commands/lib/b-tree-index.mjs");
assert("b-tree-index.mjs exists", () => { if (!existsSync(btLib)) throw new Error("missing"); });
const btMod = await import(btLib);
assert("createBTree insert and search", () => {
  const bt = btMod.createBTree(3);
  bt.insert(10); bt.insert(20); bt.insert(5);
  if (!bt.search(10)) throw new Error("should find 10");
  if (bt.search(15)) throw new Error("should not find 15");
});
assert("handles many insertions", () => {
  const bt = btMod.createBTree(3);
  for (let i = 0; i < 20; i++) bt.insert(i);
  for (let i = 0; i < 20; i++) {
    if (!bt.search(i)) throw new Error(`should find ${i}`);
  }
});
assert("inOrder returns sorted", () => {
  const bt = btMod.createBTree(3);
  bt.insert(5); bt.insert(3); bt.insert(8); bt.insert(1);
  const arr = bt.inOrder();
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] <= arr[i-1]) throw new Error("not sorted");
  }
});

console.log("\n\x1b[36m  Part 2: Key-Value Store\x1b[0m");
const kvLib = join(process.cwd(), "tools/ogu/commands/lib/kv-store.mjs");
assert("kv-store.mjs exists", () => { if (!existsSync(kvLib)) throw new Error("missing"); });
const kvMod = await import(kvLib);
assert("createKVStore set and get", () => {
  const kv = kvMod.createKVStore();
  kv.set("a", 1); kv.set("b", 2);
  if (kv.get("a") !== 1) throw new Error("should get 1");
});
assert("delete removes key", () => {
  const kv = kvMod.createKVStore();
  kv.set("x", 42); kv.delete("x");
  if (kv.get("x") !== undefined) throw new Error("should be undefined");
});
assert("has checks existence", () => {
  const kv = kvMod.createKVStore();
  kv.set("k", "v");
  if (!kv.has("k")) throw new Error("should have k");
  if (kv.has("z")) throw new Error("should not have z");
});
assert("keys returns all keys", () => {
  const kv = kvMod.createKVStore();
  kv.set("a", 1); kv.set("b", 2); kv.set("c", 3);
  if (kv.keys().length !== 3) throw new Error("should have 3 keys");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
