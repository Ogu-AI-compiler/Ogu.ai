/**
 * Slice 224 — Bipartite Checker + Euler Path
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 224 — Bipartite Checker + Euler Path\x1b[0m\n");

console.log("\x1b[36m  Part 1: Bipartite Checker\x1b[0m");
const bcLib = join(process.cwd(), "tools/ogu/commands/lib/bipartite-checker.mjs");
assert("bipartite-checker.mjs exists", () => { if (!existsSync(bcLib)) throw new Error("missing"); });
const bcMod = await import(bcLib);
assert("detects bipartite graph", () => {
  const graph = { A: ["B"], B: ["A","C"], C: ["B"] };
  if (!bcMod.isBipartite(graph)) throw new Error("should be bipartite");
});
assert("detects non-bipartite graph", () => {
  const graph = { A: ["B","C"], B: ["A","C"], C: ["A","B"] };
  if (bcMod.isBipartite(graph)) throw new Error("triangle is not bipartite");
});
assert("getPartitions returns two sets", () => {
  const graph = { A: ["B"], B: ["A","C"], C: ["B"] };
  const parts = bcMod.getPartitions(graph);
  if (!parts) throw new Error("should return partitions");
  if (parts[0].length + parts[1].length !== 3) throw new Error("should cover all nodes");
});

console.log("\n\x1b[36m  Part 2: Euler Path\x1b[0m");
const epLib = join(process.cwd(), "tools/ogu/commands/lib/euler-path.mjs");
assert("euler-path.mjs exists", () => { if (!existsSync(epLib)) throw new Error("missing"); });
const epMod = await import(epLib);
assert("hasEulerianPath checks correctly", () => {
  const graph = { A: ["B"], B: ["A","C"], C: ["B"] };
  if (!epMod.hasEulerianPath(graph)) throw new Error("should have Eulerian path");
});
assert("non-Eulerian detected", () => {
  const graph = { A: ["B","C","D"], B: ["A"], C: ["A"], D: ["A"] };
  if (epMod.hasEulerianPath(graph)) throw new Error("should not have Eulerian path");
});
assert("hasEulerianCircuit checks correctly", () => {
  const graph = { A: ["B","C"], B: ["A","C"], C: ["A","B"] };
  if (!epMod.hasEulerianCircuit(graph)) throw new Error("triangle has Eulerian circuit");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
