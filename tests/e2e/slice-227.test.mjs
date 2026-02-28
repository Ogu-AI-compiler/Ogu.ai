/**
 * Slice 227 — Line Intersection + Nearest Neighbor
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 227 — Line Intersection + Nearest Neighbor\x1b[0m\n");

console.log("\x1b[36m  Part 1: Line Intersection\x1b[0m");
const liLib = join(process.cwd(), "tools/ogu/commands/lib/line-intersection.mjs");
assert("line-intersection.mjs exists", () => { if (!existsSync(liLib)) throw new Error("missing"); });
const liMod = await import(liLib);
assert("finds intersection point", () => {
  const p = liMod.intersect([0,0],[2,2],[0,2],[2,0]);
  if (!p) throw new Error("should intersect");
  if (Math.abs(p[0] - 1) > 0.01 || Math.abs(p[1] - 1) > 0.01) throw new Error("wrong point");
});
assert("returns null for parallel lines", () => {
  const p = liMod.intersect([0,0],[1,1],[0,1],[1,2]);
  if (p !== null) throw new Error("parallel lines should return null");
});

console.log("\n\x1b[36m  Part 2: Nearest Neighbor\x1b[0m");
const nnLib = join(process.cwd(), "tools/ogu/commands/lib/nearest-neighbor.mjs");
assert("nearest-neighbor.mjs exists", () => { if (!existsSync(nnLib)) throw new Error("missing"); });
const nnMod = await import(nnLib);
assert("finds nearest point", () => {
  const points = [[0,0],[3,4],[1,1],[10,10]];
  const nearest = nnMod.findNearest([0,0], points);
  if (nearest[0] !== 0 || nearest[1] !== 0) throw new Error("should find origin");
});
assert("findKNearest returns K points", () => {
  const points = [[0,0],[1,1],[2,2],[3,3],[4,4]];
  const result = nnMod.findKNearest([0,0], points, 3);
  if (result.length !== 3) throw new Error(`expected 3, got ${result.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
