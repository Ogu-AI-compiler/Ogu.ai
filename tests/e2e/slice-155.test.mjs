/**
 * Slice 155 — Dependency Graph Analyzer + Cycle Detector
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 155 — Dependency Graph Analyzer + Cycle Detector\x1b[0m\n");

console.log("\x1b[36m  Part 1: Dependency Graph Analyzer\x1b[0m");

const dgaLib = join(process.cwd(), "tools/ogu/commands/lib/dependency-graph-analyzer.mjs");
assert("dependency-graph-analyzer.mjs exists", () => { if (!existsSync(dgaLib)) throw new Error("file missing"); });
const dgaMod = await import(dgaLib);

assert("createDepGraphAnalyzer returns analyzer", () => {
  if (typeof dgaMod.createDepGraphAnalyzer !== "function") throw new Error("missing");
  const a = dgaMod.createDepGraphAnalyzer();
  if (typeof a.addEdge !== "function") throw new Error("missing addEdge");
  if (typeof a.getDepth !== "function") throw new Error("missing getDepth");
});

assert("getDepth returns correct depth", () => {
  const a = dgaMod.createDepGraphAnalyzer();
  a.addEdge("app", "server");
  a.addEdge("server", "db");
  a.addEdge("server", "auth");
  if (a.getDepth("app") !== 2) throw new Error(`expected depth 2, got ${a.getDepth("app")}`);
  if (a.getDepth("db") !== 0) throw new Error(`expected depth 0 for leaf, got ${a.getDepth("db")}`);
});

assert("getLeaves returns leaf nodes", () => {
  const a = dgaMod.createDepGraphAnalyzer();
  a.addEdge("a", "b");
  a.addEdge("a", "c");
  a.addEdge("b", "d");
  const leaves = a.getLeaves();
  if (!leaves.includes("c")) throw new Error("c should be a leaf");
  if (!leaves.includes("d")) throw new Error("d should be a leaf");
  if (leaves.includes("a")) throw new Error("a should not be a leaf");
});

assert("getRoots returns root nodes", () => {
  const a = dgaMod.createDepGraphAnalyzer();
  a.addEdge("app", "lib");
  a.addEdge("test", "lib");
  const roots = a.getRoots();
  if (!roots.includes("app")) throw new Error("app should be a root");
  if (!roots.includes("test")) throw new Error("test should be a root");
  if (roots.includes("lib")) throw new Error("lib should not be a root");
});

console.log("\n\x1b[36m  Part 2: Cycle Detector\x1b[0m");

const cdLib = join(process.cwd(), "tools/ogu/commands/lib/cycle-detector.mjs");
assert("cycle-detector.mjs exists", () => { if (!existsSync(cdLib)) throw new Error("file missing"); });
const cdMod = await import(cdLib);

assert("detectCycles returns empty for DAG", () => {
  if (typeof cdMod.detectCycles !== "function") throw new Error("missing");
  const cycles = cdMod.detectCycles({
    edges: [["a", "b"], ["b", "c"], ["a", "c"]],
  });
  if (cycles.length !== 0) throw new Error("DAG should have no cycles");
});

assert("detectCycles finds simple cycle", () => {
  const cycles = cdMod.detectCycles({
    edges: [["a", "b"], ["b", "c"], ["c", "a"]],
  });
  if (cycles.length === 0) throw new Error("should detect cycle");
});

assert("detectCycles finds self-loop", () => {
  const cycles = cdMod.detectCycles({
    edges: [["a", "a"]],
  });
  if (cycles.length === 0) throw new Error("should detect self-loop");
});

assert("detectCycles handles complex graphs", () => {
  const cycles = cdMod.detectCycles({
    edges: [["a", "b"], ["b", "c"], ["c", "d"], ["d", "b"], ["a", "e"]],
  });
  if (cycles.length === 0) throw new Error("should detect cycle b→c→d→b");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
