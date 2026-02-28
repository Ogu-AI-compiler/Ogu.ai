/**
 * Slice 222 — Weighted Graph + Shortest Path Dijkstra
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 222 — Weighted Graph + Shortest Path Dijkstra\x1b[0m\n");

console.log("\x1b[36m  Part 1: Weighted Graph\x1b[0m");
const wgLib = join(process.cwd(), "tools/ogu/commands/lib/weighted-graph.mjs");
assert("weighted-graph.mjs exists", () => { if (!existsSync(wgLib)) throw new Error("missing"); });
const wgMod = await import(wgLib);
assert("addEdge with weight", () => {
  const g = wgMod.createWeightedGraph();
  g.addEdge("A", "B", 5);
  const edges = g.getEdges("A");
  if (edges.length !== 1) throw new Error("expected 1 edge");
  if (edges[0].weight !== 5) throw new Error("weight should be 5");
});
assert("getNodes returns all", () => {
  const g = wgMod.createWeightedGraph();
  g.addEdge("A", "B", 1); g.addEdge("B", "C", 2);
  if (g.getNodes().length !== 3) throw new Error("expected 3");
});

console.log("\n\x1b[36m  Part 2: Shortest Path Dijkstra\x1b[0m");
const spLib = join(process.cwd(), "tools/ogu/commands/lib/shortest-path-dijkstra.mjs");
assert("shortest-path-dijkstra.mjs exists", () => { if (!existsSync(spLib)) throw new Error("missing"); });
const spMod = await import(spLib);
assert("finds shortest path", () => {
  const graph = { A: [{to:"B",w:1},{to:"C",w:4}], B: [{to:"C",w:2}], C: [] };
  const result = spMod.dijkstra(graph, "A");
  if (result.A !== 0) throw new Error("A should be 0");
  if (result.B !== 1) throw new Error("B should be 1");
  if (result.C !== 3) throw new Error(`C should be 3, got ${result.C}`);
});
assert("unreachable nodes have Infinity", () => {
  const graph = { A: [{to:"B",w:1}], B: [], C: [] };
  const result = spMod.dijkstra(graph, "A");
  if (result.C !== Infinity) throw new Error("C should be Infinity");
});
assert("getPath returns path", () => {
  const graph = { A: [{to:"B",w:1},{to:"C",w:10}], B: [{to:"C",w:2}], C: [] };
  const path = spMod.getPath(graph, "A", "C");
  if (path[0] !== "A" || path[path.length-1] !== "C") throw new Error("path endpoints wrong");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
