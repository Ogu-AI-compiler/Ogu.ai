/**
 * Slice 212 — Sparse Matrix + Dense Vector
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 212 — Sparse Matrix + Dense Vector\x1b[0m\n");

console.log("\x1b[36m  Part 1: Sparse Matrix\x1b[0m");
const smLib = join(process.cwd(), "tools/ogu/commands/lib/sparse-matrix.mjs");
assert("sparse-matrix.mjs exists", () => { if (!existsSync(smLib)) throw new Error("missing"); });
const smMod = await import(smLib);
assert("set and get values", () => {
  const m = smMod.createSparseMatrix();
  m.set(0, 0, 5); m.set(1, 2, 10);
  if (m.get(0, 0) !== 5) throw new Error("expected 5");
  if (m.get(1, 2) !== 10) throw new Error("expected 10");
  if (m.get(3, 3) !== 0) throw new Error("default should be 0");
});
assert("getNonZeroCount returns count", () => {
  const m = smMod.createSparseMatrix();
  m.set(0, 0, 1); m.set(1, 1, 2); m.set(2, 2, 3);
  if (m.getNonZeroCount() !== 3) throw new Error("expected 3");
});
assert("toArray converts to dense", () => {
  const m = smMod.createSparseMatrix();
  m.set(0, 0, 1); m.set(0, 1, 2);
  const arr = m.toArray(1, 2);
  if (arr[0][0] !== 1 || arr[0][1] !== 2) throw new Error("wrong values");
});

console.log("\n\x1b[36m  Part 2: Dense Vector\x1b[0m");
const dvLib = join(process.cwd(), "tools/ogu/commands/lib/dense-vector.mjs");
assert("dense-vector.mjs exists", () => { if (!existsSync(dvLib)) throw new Error("missing"); });
const dvMod = await import(dvLib);
assert("createDenseVector stores values", () => {
  const v = dvMod.createDenseVector([1, 2, 3]);
  if (v.get(0) !== 1 || v.get(2) !== 3) throw new Error("wrong values");
});
assert("dot product", () => {
  const a = dvMod.createDenseVector([1, 2, 3]);
  const b = dvMod.createDenseVector([4, 5, 6]);
  if (a.dot(b) !== 32) throw new Error("expected 32");
});
assert("scale multiplies all", () => {
  const v = dvMod.createDenseVector([1, 2, 3]);
  const scaled = v.scale(2);
  if (scaled.get(0) !== 2 || scaled.get(2) !== 6) throw new Error("wrong");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
