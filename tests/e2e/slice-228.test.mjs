/**
 * Slice 228 — Quad Tree + R-Tree
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 228 — Quad Tree + R-Tree\x1b[0m\n");

console.log("\x1b[36m  Part 1: Quad Tree\x1b[0m");
const qtLib = join(process.cwd(), "tools/ogu/commands/lib/quad-tree.mjs");
assert("quad-tree.mjs exists", () => { if (!existsSync(qtLib)) throw new Error("missing"); });
const qtMod = await import(qtLib);
assert("insert and query", () => {
  const qt = qtMod.createQuadTree({ x: 0, y: 0, w: 100, h: 100 });
  qt.insert({ x: 10, y: 10, data: "A" });
  qt.insert({ x: 90, y: 90, data: "B" });
  const results = qt.query({ x: 0, y: 0, w: 50, h: 50 });
  if (results.length !== 1) throw new Error(`expected 1, got ${results.length}`);
  if (results[0].data !== "A") throw new Error("should find A");
});
assert("handles many points", () => {
  const qt = qtMod.createQuadTree({ x: 0, y: 0, w: 100, h: 100 });
  for (let i = 0; i < 20; i++) qt.insert({ x: i * 5, y: i * 5, data: i });
  const all = qt.query({ x: 0, y: 0, w: 100, h: 100 });
  if (all.length !== 20) throw new Error(`expected 20, got ${all.length}`);
});

console.log("\n\x1b[36m  Part 2: R-Tree\x1b[0m");
const rtLib = join(process.cwd(), "tools/ogu/commands/lib/r-tree.mjs");
assert("r-tree.mjs exists", () => { if (!existsSync(rtLib)) throw new Error("missing"); });
const rtMod = await import(rtLib);
assert("insert and search", () => {
  const rt = rtMod.createRTree();
  rt.insert({ minX: 0, minY: 0, maxX: 10, maxY: 10, data: "A" });
  rt.insert({ minX: 20, minY: 20, maxX: 30, maxY: 30, data: "B" });
  const results = rt.search({ minX: 5, minY: 5, maxX: 15, maxY: 15 });
  if (results.length !== 1) throw new Error(`expected 1, got ${results.length}`);
});
assert("getAll returns all items", () => {
  const rt = rtMod.createRTree();
  rt.insert({ minX: 0, minY: 0, maxX: 1, maxY: 1, data: "X" });
  rt.insert({ minX: 2, minY: 2, maxX: 3, maxY: 3, data: "Y" });
  if (rt.getAll().length !== 2) throw new Error("expected 2");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
