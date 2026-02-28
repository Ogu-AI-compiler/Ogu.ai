/**
 * Slice 221 — Adjacency Matrix + Adjacency List
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 221 — Adjacency Matrix + Adjacency List\x1b[0m\n");

console.log("\x1b[36m  Part 1: Adjacency Matrix\x1b[0m");
const amLib = join(process.cwd(), "tools/ogu/commands/lib/adjacency-matrix.mjs");
assert("adjacency-matrix.mjs exists", () => { if (!existsSync(amLib)) throw new Error("missing"); });
const amMod = await import(amLib);
assert("addEdge and hasEdge", () => {
  const g = amMod.createAdjacencyMatrix(4);
  g.addEdge(0, 1); g.addEdge(2, 3);
  if (!g.hasEdge(0, 1)) throw new Error("should have 0->1");
  if (g.hasEdge(0, 2)) throw new Error("should not have 0->2");
});
assert("getNeighbors returns connected nodes", () => {
  const g = amMod.createAdjacencyMatrix(3);
  g.addEdge(0, 1); g.addEdge(0, 2);
  const n = g.getNeighbors(0);
  if (n.length !== 2) throw new Error(`expected 2, got ${n.length}`);
});

console.log("\n\x1b[36m  Part 2: Adjacency List\x1b[0m");
const alLib = join(process.cwd(), "tools/ogu/commands/lib/adjacency-list.mjs");
assert("adjacency-list.mjs exists", () => { if (!existsSync(alLib)) throw new Error("missing"); });
const alMod = await import(alLib);
assert("addEdge and getNeighbors", () => {
  const g = alMod.createAdjacencyList();
  g.addEdge("A", "B"); g.addEdge("A", "C");
  const n = g.getNeighbors("A");
  if (n.length !== 2) throw new Error(`expected 2, got ${n.length}`);
});
assert("getNodes returns all nodes", () => {
  const g = alMod.createAdjacencyList();
  g.addEdge("X", "Y"); g.addEdge("Y", "Z");
  const nodes = g.getNodes();
  if (nodes.length !== 3) throw new Error(`expected 3, got ${nodes.length}`);
});
assert("hasEdge works", () => {
  const g = alMod.createAdjacencyList();
  g.addEdge("A", "B");
  if (!g.hasEdge("A", "B")) throw new Error("should have A->B");
  if (g.hasEdge("B", "A")) throw new Error("directed: should not have B->A");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
