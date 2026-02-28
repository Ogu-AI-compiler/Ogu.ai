/**
 * Slice 94 — Dependency Graph Analyzer + Circular Dependency Detector
 *
 * Dep graph: build and analyze module dependency graphs.
 * Circular detector: detect and report cycles in dependency chains.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 94 — Dependency Graph Analyzer + Circular Dependency Detector\x1b[0m\n");

// ── Part 1: Dependency Graph Analyzer ──────────────────────────────

console.log("\x1b[36m  Part 1: Dependency Graph Analyzer\x1b[0m");

const dgLib = join(process.cwd(), "tools/ogu/commands/lib/dep-graph-analyzer.mjs");
assert("dep-graph-analyzer.mjs exists", () => {
  if (!existsSync(dgLib)) throw new Error("file missing");
});

const dgMod = await import(dgLib);

assert("createDepGraph returns graph", () => {
  if (typeof dgMod.createDepGraph !== "function") throw new Error("missing");
  const g = dgMod.createDepGraph();
  if (typeof g.addNode !== "function") throw new Error("missing addNode");
  if (typeof g.addEdge !== "function") throw new Error("missing addEdge");
  if (typeof g.getDependencies !== "function") throw new Error("missing getDependencies");
});

assert("addNode and addEdge build graph", () => {
  const g = dgMod.createDepGraph();
  g.addNode("a");
  g.addNode("b");
  g.addNode("c");
  g.addEdge("a", "b");
  g.addEdge("b", "c");
  const deps = g.getDependencies("a");
  if (!deps.includes("b")) throw new Error("a should depend on b");
});

assert("getTransitiveDeps returns all transitive dependencies", () => {
  const g = dgMod.createDepGraph();
  g.addNode("a"); g.addNode("b"); g.addNode("c"); g.addNode("d");
  g.addEdge("a", "b");
  g.addEdge("b", "c");
  g.addEdge("c", "d");
  const trans = g.getTransitiveDeps("a");
  if (!trans.includes("b") || !trans.includes("c") || !trans.includes("d")) {
    throw new Error("should include all transitive deps");
  }
});

assert("getDependents returns reverse dependencies", () => {
  const g = dgMod.createDepGraph();
  g.addNode("a"); g.addNode("b"); g.addNode("c");
  g.addEdge("a", "c");
  g.addEdge("b", "c");
  const dependents = g.getDependents("c");
  if (dependents.length !== 2) throw new Error(`expected 2, got ${dependents.length}`);
});

assert("getNodes returns all nodes", () => {
  const g = dgMod.createDepGraph();
  g.addNode("x"); g.addNode("y");
  const nodes = g.getNodes();
  if (nodes.length !== 2) throw new Error(`expected 2, got ${nodes.length}`);
});

// ── Part 2: Circular Dependency Detector ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Circular Dependency Detector\x1b[0m");

const cdLib = join(process.cwd(), "tools/ogu/commands/lib/circular-dep-detector.mjs");
assert("circular-dep-detector.mjs exists", () => {
  if (!existsSync(cdLib)) throw new Error("file missing");
});

const cdMod = await import(cdLib);

assert("detectCycles finds no cycles in DAG", () => {
  if (typeof cdMod.detectCycles !== "function") throw new Error("missing");
  const edges = { a: ["b"], b: ["c"], c: [] };
  const cycles = cdMod.detectCycles(edges);
  if (cycles.length !== 0) throw new Error("DAG should have no cycles");
});

assert("detectCycles finds simple cycle", () => {
  const edges = { a: ["b"], b: ["c"], c: ["a"] };
  const cycles = cdMod.detectCycles(edges);
  if (cycles.length === 0) throw new Error("should detect cycle a→b→c→a");
});

assert("detectCycles finds self-loop", () => {
  const edges = { a: ["a"] };
  const cycles = cdMod.detectCycles(edges);
  if (cycles.length === 0) throw new Error("should detect self-loop");
});

assert("detectCycles handles disconnected components", () => {
  const edges = { a: ["b"], b: [], c: ["d"], d: ["c"] };
  const cycles = cdMod.detectCycles(edges);
  if (cycles.length === 0) throw new Error("should detect cycle in c↔d");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
