/**
 * Slice 192 — Skip List + Sorted Set
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 192 — Skip List + Sorted Set\x1b[0m\n");

console.log("\x1b[36m  Part 1: Skip List\x1b[0m");
const slLib = join(process.cwd(), "tools/ogu/commands/lib/skip-list.mjs");
assert("skip-list.mjs exists", () => { if (!existsSync(slLib)) throw new Error("missing"); });
const slMod = await import(slLib);
assert("createSkipList inserts and searches", () => {
  const sl = slMod.createSkipList();
  sl.insert(5); sl.insert(3); sl.insert(8);
  if (!sl.search(5)) throw new Error("should find 5");
  if (sl.search(4)) throw new Error("should not find 4");
});
assert("toArray returns sorted order", () => {
  const sl = slMod.createSkipList();
  sl.insert(10); sl.insert(2); sl.insert(7);
  const arr = sl.toArray();
  if (arr[0] !== 2 || arr[1] !== 7 || arr[2] !== 10) throw new Error(`wrong order: ${arr}`);
});
assert("size tracks count", () => {
  const sl = slMod.createSkipList();
  sl.insert(1); sl.insert(2);
  if (sl.size() !== 2) throw new Error(`expected 2, got ${sl.size()}`);
});
assert("remove works", () => {
  const sl = slMod.createSkipList();
  sl.insert(1); sl.insert(2); sl.insert(3);
  sl.remove(2);
  if (sl.search(2)) throw new Error("should not find 2");
  if (sl.size() !== 2) throw new Error("size should be 2");
});

console.log("\n\x1b[36m  Part 2: Sorted Set\x1b[0m");
const ssLib = join(process.cwd(), "tools/ogu/commands/lib/sorted-set.mjs");
assert("sorted-set.mjs exists", () => { if (!existsSync(ssLib)) throw new Error("missing"); });
const ssMod = await import(ssLib);
assert("createSortedSet add and has", () => {
  const s = ssMod.createSortedSet();
  s.add(5); s.add(3); s.add(8);
  if (!s.has(5)) throw new Error("should have 5");
  if (s.has(4)) throw new Error("should not have 4");
});
assert("toArray returns sorted", () => {
  const s = ssMod.createSortedSet();
  s.add(10); s.add(2); s.add(7);
  const arr = s.toArray();
  if (arr[0] !== 2 || arr[1] !== 7 || arr[2] !== 10) throw new Error("wrong order");
});
assert("deduplicates", () => {
  const s = ssMod.createSortedSet();
  s.add(1); s.add(1); s.add(1);
  if (s.size() !== 1) throw new Error("should be 1");
});
assert("remove works", () => {
  const s = ssMod.createSortedSet();
  s.add(1); s.add(2); s.add(3);
  s.remove(2);
  if (s.has(2)) throw new Error("should not have 2");
  if (s.size() !== 2) throw new Error("size should be 2");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
