/**
 * Slice 238 — Binary Search Variants + Interpolation Search
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 238 — Binary Search Variants + Interpolation Search\x1b[0m\n");
console.log("\x1b[36m  Part 1: Binary Search Variants\x1b[0m");
const bsLib = join(process.cwd(), "tools/ogu/commands/lib/binary-search-variants.mjs");
assert("binary-search-variants.mjs exists", () => { if (!existsSync(bsLib)) throw new Error("missing"); });
const bsMod = await import(bsLib);
assert("lowerBound finds first >=", () => {
  const idx = bsMod.lowerBound([1,2,4,4,5], 4);
  if (idx !== 2) throw new Error(`expected 2, got ${idx}`);
});
assert("upperBound finds first >", () => {
  const idx = bsMod.upperBound([1,2,4,4,5], 4);
  if (idx !== 4) throw new Error(`expected 4, got ${idx}`);
});
assert("binarySearch finds element", () => {
  const idx = bsMod.binarySearch([1,3,5,7,9], 5);
  if (idx !== 2) throw new Error(`expected 2, got ${idx}`);
});
console.log("\n\x1b[36m  Part 2: Interpolation Search\x1b[0m");
const isLib = join(process.cwd(), "tools/ogu/commands/lib/interpolation-search.mjs");
assert("interpolation-search.mjs exists", () => { if (!existsSync(isLib)) throw new Error("missing"); });
const isMod = await import(isLib);
assert("finds element in uniform array", () => {
  const idx = isMod.interpolationSearch([10,20,30,40,50], 30);
  if (idx !== 2) throw new Error(`expected 2, got ${idx}`);
});
assert("returns -1 for missing", () => {
  const idx = isMod.interpolationSearch([1,2,3], 5);
  if (idx !== -1) throw new Error("should return -1");
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
