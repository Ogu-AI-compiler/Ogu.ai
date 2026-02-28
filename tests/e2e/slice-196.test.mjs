/**
 * Slice 196 — Graph Traversal + Path Finder
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 196 — Graph Traversal + Path Finder\x1b[0m\n");

console.log("\x1b[36m  Part 1: Graph Traversal\x1b[0m");
const gtLib = join(process.cwd(), "tools/ogu/commands/lib/graph-traversal.mjs");
assert("graph-traversal.mjs exists", () => { if (!existsSync(gtLib)) throw new Error("missing"); });
const gtMod = await import(gtLib);
assert("bfs returns correct order", () => {
  const graph = { A: ["B", "C"], B: ["D"], C: ["D"], D: [] };
  const result = gtMod.bfs(graph, "A");
  if (result[0] !== "A") throw new Error("should start with A");
  if (!result.includes("D")) throw new Error("should include D");
});
assert("dfs returns correct order", () => {
  const graph = { A: ["B", "C"], B: ["D"], C: [], D: [] };
  const result = gtMod.dfs(graph, "A");
  if (result[0] !== "A") throw new Error("should start with A");
  if (result.length !== 4) throw new Error(`expected 4, got ${result.length}`);
});
assert("bfs handles cycles", () => {
  const graph = { A: ["B"], B: ["A"] };
  const result = gtMod.bfs(graph, "A");
  if (result.length !== 2) throw new Error("should visit each node once");
});

console.log("\n\x1b[36m  Part 2: Path Finder\x1b[0m");
const pfLib = join(process.cwd(), "tools/ogu/commands/lib/path-finder.mjs");
assert("path-finder.mjs exists", () => { if (!existsSync(pfLib)) throw new Error("missing"); });
const pfMod = await import(pfLib);
assert("findPath finds shortest path", () => {
  const graph = { A: ["B", "C"], B: ["D"], C: ["D"], D: [] };
  const path = pfMod.findPath(graph, "A", "D");
  if (!path) throw new Error("should find path");
  if (path[0] !== "A" || path[path.length-1] !== "D") throw new Error("path endpoints wrong");
  if (path.length !== 3) throw new Error(`expected 3, got ${path.length}`);
});
assert("returns null when no path", () => {
  const graph = { A: ["B"], B: [], C: [] };
  const path = pfMod.findPath(graph, "A", "C");
  if (path !== null) throw new Error("should return null");
});
assert("findAllPaths returns all paths", () => {
  const graph = { A: ["B", "C"], B: ["D"], C: ["D"], D: [] };
  const paths = pfMod.findAllPaths(graph, "A", "D");
  if (paths.length !== 2) throw new Error(`expected 2 paths, got ${paths.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
