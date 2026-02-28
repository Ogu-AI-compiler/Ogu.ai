/**
 * Slice 223 — Minimum Spanning Tree + Graph Coloring
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 223 — Minimum Spanning Tree + Graph Coloring\x1b[0m\n");

console.log("\x1b[36m  Part 1: Minimum Spanning Tree\x1b[0m");
const mstLib = join(process.cwd(), "tools/ogu/commands/lib/minimum-spanning-tree.mjs");
assert("minimum-spanning-tree.mjs exists", () => { if (!existsSync(mstLib)) throw new Error("missing"); });
const mstMod = await import(mstLib);
assert("kruskal returns MST edges", () => {
  const edges = [{u:"A",v:"B",w:1},{u:"B",v:"C",w:2},{u:"A",v:"C",w:3}];
  const mst = mstMod.kruskal(["A","B","C"], edges);
  if (mst.length !== 2) throw new Error(`expected 2 edges, got ${mst.length}`);
  const total = mst.reduce((s, e) => s + e.w, 0);
  if (total !== 3) throw new Error(`expected weight 3, got ${total}`);
});
assert("handles disconnected graph", () => {
  const edges = [{u:"A",v:"B",w:1}];
  const mst = mstMod.kruskal(["A","B","C"], edges);
  if (mst.length !== 1) throw new Error("only 1 edge possible");
});

console.log("\n\x1b[36m  Part 2: Graph Coloring\x1b[0m");
const gcLib = join(process.cwd(), "tools/ogu/commands/lib/graph-coloring.mjs");
assert("graph-coloring.mjs exists", () => { if (!existsSync(gcLib)) throw new Error("missing"); });
const gcMod = await import(gcLib);
assert("greedy coloring assigns colors", () => {
  const graph = { A: ["B","C"], B: ["A","C"], C: ["A","B"] };
  const colors = gcMod.greedyColoring(graph);
  if (colors.A === colors.B) throw new Error("A and B should differ");
  if (colors.A === colors.C) throw new Error("A and C should differ");
  if (colors.B === colors.C) throw new Error("B and C should differ");
});
assert("chromaticNumber returns minimum colors", () => {
  const graph = { A: ["B","C"], B: ["A","C"], C: ["A","B"] };
  const colors = gcMod.greedyColoring(graph);
  const numColors = new Set(Object.values(colors)).size;
  if (numColors > 3) throw new Error("triangle needs at most 3 colors");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
