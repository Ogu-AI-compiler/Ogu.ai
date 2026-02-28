/**
 * Slice 204 — Matrix Operations + Vector Math
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 204 — Matrix Operations + Vector Math\x1b[0m\n");

console.log("\x1b[36m  Part 1: Matrix Operations\x1b[0m");
const mLib = join(process.cwd(), "tools/ogu/commands/lib/matrix-operations.mjs");
assert("matrix-operations.mjs exists", () => { if (!existsSync(mLib)) throw new Error("missing"); });
const mMod = await import(mLib);
assert("multiply 2x2 matrices", () => {
  const a = [[1,2],[3,4]];
  const b = [[5,6],[7,8]];
  const r = mMod.multiply(a, b);
  if (r[0][0] !== 19 || r[0][1] !== 22) throw new Error(`wrong: ${JSON.stringify(r)}`);
  if (r[1][0] !== 43 || r[1][1] !== 50) throw new Error(`wrong: ${JSON.stringify(r)}`);
});
assert("transpose works", () => {
  const m = [[1,2,3],[4,5,6]];
  const t = mMod.transpose(m);
  if (t.length !== 3 || t[0].length !== 2) throw new Error("wrong dimensions");
  if (t[0][0] !== 1 || t[0][1] !== 4) throw new Error("wrong values");
});
assert("identity creates identity matrix", () => {
  const id = mMod.identity(3);
  if (id[0][0] !== 1 || id[1][1] !== 1 || id[2][2] !== 1) throw new Error("wrong diagonal");
  if (id[0][1] !== 0 || id[1][0] !== 0) throw new Error("off-diagonal should be 0");
});

console.log("\n\x1b[36m  Part 2: Vector Math\x1b[0m");
const vLib = join(process.cwd(), "tools/ogu/commands/lib/vector-math.mjs");
assert("vector-math.mjs exists", () => { if (!existsSync(vLib)) throw new Error("missing"); });
const vMod = await import(vLib);
assert("dot product", () => {
  const r = vMod.dot([1,2,3], [4,5,6]);
  if (r !== 32) throw new Error(`expected 32, got ${r}`);
});
assert("add vectors", () => {
  const r = vMod.add([1,2], [3,4]);
  if (r[0] !== 4 || r[1] !== 6) throw new Error("wrong");
});
assert("magnitude", () => {
  const r = vMod.magnitude([3,4]);
  if (r !== 5) throw new Error(`expected 5, got ${r}`);
});
assert("normalize", () => {
  const r = vMod.normalize([3,4]);
  if (Math.abs(r[0] - 0.6) > 0.001 || Math.abs(r[1] - 0.8) > 0.001) throw new Error("wrong");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
