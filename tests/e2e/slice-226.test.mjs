/**
 * Slice 226 — Convex Hull + Point-in-Polygon
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 226 — Convex Hull + Point-in-Polygon\x1b[0m\n");

console.log("\x1b[36m  Part 1: Convex Hull\x1b[0m");
const chLib = join(process.cwd(), "tools/ogu/commands/lib/convex-hull.mjs");
assert("convex-hull.mjs exists", () => { if (!existsSync(chLib)) throw new Error("missing"); });
const chMod = await import(chLib);
assert("convexHull returns hull points", () => {
  const points = [[0,0],[1,0],[0,1],[1,1],[0.5,0.5]];
  const hull = chMod.convexHull(points);
  if (hull.length !== 4) throw new Error(`expected 4, got ${hull.length}`);
});
assert("triangle hull is itself", () => {
  const points = [[0,0],[1,0],[0,1]];
  const hull = chMod.convexHull(points);
  if (hull.length !== 3) throw new Error("triangle hull should be 3");
});

console.log("\n\x1b[36m  Part 2: Point-in-Polygon\x1b[0m");
const pipLib = join(process.cwd(), "tools/ogu/commands/lib/point-in-polygon.mjs");
assert("point-in-polygon.mjs exists", () => { if (!existsSync(pipLib)) throw new Error("missing"); });
const pipMod = await import(pipLib);
assert("detects point inside", () => {
  const polygon = [[0,0],[4,0],[4,4],[0,4]];
  if (!pipMod.isInside([2,2], polygon)) throw new Error("should be inside");
});
assert("detects point outside", () => {
  const polygon = [[0,0],[4,0],[4,4],[0,4]];
  if (pipMod.isInside([5,5], polygon)) throw new Error("should be outside");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
