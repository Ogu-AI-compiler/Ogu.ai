/**
 * Slice 219 — Sliding Window Max + Monotonic Stack
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 219 — Sliding Window Max + Monotonic Stack\x1b[0m\n");

console.log("\x1b[36m  Part 1: Sliding Window Max\x1b[0m");
const swLib = join(process.cwd(), "tools/ogu/commands/lib/sliding-window-max.mjs");
assert("sliding-window-max.mjs exists", () => { if (!existsSync(swLib)) throw new Error("missing"); });
const swMod = await import(swLib);
assert("returns max for each window", () => {
  const result = swMod.slidingWindowMax([1, 3, -1, -3, 5, 3, 6, 7], 3);
  const expected = [3, 3, 5, 5, 6, 7];
  for (let i = 0; i < expected.length; i++) {
    if (result[i] !== expected[i]) throw new Error(`mismatch at ${i}: ${result[i]} !== ${expected[i]}`);
  }
});
assert("handles window size 1", () => {
  const result = swMod.slidingWindowMax([5, 3, 8], 1);
  if (result[0] !== 5 || result[1] !== 3 || result[2] !== 8) throw new Error("wrong");
});

console.log("\n\x1b[36m  Part 2: Monotonic Stack\x1b[0m");
const msLib = join(process.cwd(), "tools/ogu/commands/lib/monotonic-stack.mjs");
assert("monotonic-stack.mjs exists", () => { if (!existsSync(msLib)) throw new Error("missing"); });
const msMod = await import(msLib);
assert("nextGreaterElement works", () => {
  const result = msMod.nextGreaterElement([4, 5, 2, 10, 8]);
  if (result[0] !== 5) throw new Error(`expected 5 for index 0, got ${result[0]}`);
  if (result[2] !== 10) throw new Error(`expected 10 for index 2, got ${result[2]}`);
  if (result[4] !== -1) throw new Error("last should be -1");
});
assert("nextSmallerElement works", () => {
  const result = msMod.nextSmallerElement([4, 5, 2, 10, 8]);
  if (result[0] !== 2) throw new Error(`expected 2 for index 0, got ${result[0]}`);
  if (result[2] !== -1) throw new Error("should be -1 for smallest");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
