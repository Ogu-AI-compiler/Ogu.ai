/**
 * Slice 217 — Radix Sort + Counting Sort
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 217 — Radix Sort + Counting Sort\x1b[0m\n");

console.log("\x1b[36m  Part 1: Radix Sort\x1b[0m");
const rsLib = join(process.cwd(), "tools/ogu/commands/lib/radix-sort.mjs");
assert("radix-sort.mjs exists", () => { if (!existsSync(rsLib)) throw new Error("missing"); });
const rsMod = await import(rsLib);
assert("sorts numbers correctly", () => {
  const result = rsMod.radixSort([170, 45, 75, 90, 802, 24, 2, 66]);
  const expected = [2, 24, 45, 66, 75, 90, 170, 802];
  for (let i = 0; i < expected.length; i++) {
    if (result[i] !== expected[i]) throw new Error(`mismatch at ${i}: ${result[i]} !== ${expected[i]}`);
  }
});
assert("handles empty array", () => {
  if (rsMod.radixSort([]).length !== 0) throw new Error("should be empty");
});
assert("handles single element", () => {
  const r = rsMod.radixSort([42]);
  if (r[0] !== 42) throw new Error("should be 42");
});

console.log("\n\x1b[36m  Part 2: Counting Sort\x1b[0m");
const csLib = join(process.cwd(), "tools/ogu/commands/lib/counting-sort.mjs");
assert("counting-sort.mjs exists", () => { if (!existsSync(csLib)) throw new Error("missing"); });
const csMod = await import(csLib);
assert("sorts correctly", () => {
  const result = csMod.countingSort([4, 2, 2, 8, 3, 3, 1]);
  const expected = [1, 2, 2, 3, 3, 4, 8];
  for (let i = 0; i < expected.length; i++) {
    if (result[i] !== expected[i]) throw new Error(`mismatch at ${i}`);
  }
});
assert("handles already sorted", () => {
  const result = csMod.countingSort([1, 2, 3, 4, 5]);
  if (result[0] !== 1 || result[4] !== 5) throw new Error("wrong");
});
assert("handles empty", () => {
  if (csMod.countingSort([]).length !== 0) throw new Error("should be empty");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
