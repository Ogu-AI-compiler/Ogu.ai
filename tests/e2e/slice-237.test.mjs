/**
 * Slice 237 — Heap Sort + Merge Sort
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 237 — Heap Sort + Merge Sort\x1b[0m\n");
console.log("\x1b[36m  Part 1: Heap Sort\x1b[0m");
const hsLib = join(process.cwd(), "tools/ogu/commands/lib/heap-sort.mjs");
assert("heap-sort.mjs exists", () => { if (!existsSync(hsLib)) throw new Error("missing"); });
const hsMod = await import(hsLib);
assert("sorts correctly", () => {
  const r = hsMod.heapSort([5,3,8,1,9,2]);
  if (r[0]!==1||r[5]!==9) throw new Error("wrong order");
});
assert("handles empty", () => { if (hsMod.heapSort([]).length!==0) throw new Error("should be empty"); });
console.log("\n\x1b[36m  Part 2: Merge Sort\x1b[0m");
const msLib = join(process.cwd(), "tools/ogu/commands/lib/merge-sort.mjs");
assert("merge-sort.mjs exists", () => { if (!existsSync(msLib)) throw new Error("missing"); });
const msMod = await import(msLib);
assert("sorts correctly", () => {
  const r = msMod.mergeSort([5,3,8,1,9,2]);
  if (r[0]!==1||r[5]!==9) throw new Error("wrong order");
});
assert("stable sort preserves order", () => {
  const r = msMod.mergeSort([3,1,2]);
  if (r[0]!==1||r[1]!==2||r[2]!==3) throw new Error("wrong");
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
