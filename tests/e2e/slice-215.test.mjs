/**
 * Slice 215 — Fenwick Tree + Segment Tree
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 215 — Fenwick Tree + Segment Tree\x1b[0m\n");

console.log("\x1b[36m  Part 1: Fenwick Tree\x1b[0m");
const ftLib = join(process.cwd(), "tools/ogu/commands/lib/fenwick-tree.mjs");
assert("fenwick-tree.mjs exists", () => { if (!existsSync(ftLib)) throw new Error("missing"); });
const ftMod = await import(ftLib);
assert("update and prefixSum", () => {
  const ft = ftMod.createFenwickTree(5);
  ft.update(0, 3); ft.update(1, 2); ft.update(2, 5);
  if (ft.prefixSum(2) !== 10) throw new Error(`expected 10, got ${ft.prefixSum(2)}`);
});
assert("rangeSum works", () => {
  const ft = ftMod.createFenwickTree(5);
  ft.update(0, 1); ft.update(1, 2); ft.update(2, 3); ft.update(3, 4);
  if (ft.rangeSum(1, 3) !== 9) throw new Error(`expected 9, got ${ft.rangeSum(1, 3)}`);
});

console.log("\n\x1b[36m  Part 2: Segment Tree\x1b[0m");
const stLib = join(process.cwd(), "tools/ogu/commands/lib/segment-tree.mjs");
assert("segment-tree.mjs exists", () => { if (!existsSync(stLib)) throw new Error("missing"); });
const stMod = await import(stLib);
assert("build and query sum", () => {
  const st = stMod.createSegmentTree([1, 3, 5, 7, 9]);
  if (st.query(0, 2) !== 9) throw new Error(`expected 9, got ${st.query(0, 2)}`);
});
assert("update and re-query", () => {
  const st = stMod.createSegmentTree([1, 3, 5, 7, 9]);
  st.update(1, 10);
  if (st.query(0, 1) !== 11) throw new Error(`expected 11, got ${st.query(0, 1)}`);
});
assert("full range query", () => {
  const st = stMod.createSegmentTree([2, 4, 6]);
  if (st.query(0, 2) !== 12) throw new Error(`expected 12, got ${st.query(0, 2)}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
