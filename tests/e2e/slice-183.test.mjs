/**
 * Slice 183 — Topology Sorter + Dependency Resolver
 *
 * Topology Sorter: topological sort with layer detection.
 * Dependency Resolver: resolve dependencies with conflict detection.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 183 — Topology Sorter + Dependency Resolver\x1b[0m\n");

console.log("\x1b[36m  Part 1: Topology Sorter\x1b[0m");
const tsLib = join(process.cwd(), "tools/ogu/commands/lib/topology-sorter.mjs");
assert("topology-sorter.mjs exists", () => { if (!existsSync(tsLib)) throw new Error("file missing"); });
const tsMod = await import(tsLib);

assert("topoSort returns ordered nodes", () => {
  if (typeof tsMod.topoSort !== "function") throw new Error("missing");
  const result = tsMod.topoSort({
    edges: [["a", "b"], ["b", "c"], ["a", "c"]],
  });
  if (!result.sorted) throw new Error("should have sorted");
  const idxA = result.sorted.indexOf("a");
  const idxB = result.sorted.indexOf("b");
  const idxC = result.sorted.indexOf("c");
  if (idxA > idxB || idxB > idxC) throw new Error("wrong order");
});

assert("topoSort detects cycles", () => {
  const result = tsMod.topoSort({
    edges: [["a", "b"], ["b", "c"], ["c", "a"]],
  });
  if (!result.hasCycle) throw new Error("should detect cycle");
});

assert("getLayers returns parallel layers", () => {
  if (typeof tsMod.getLayers !== "function") throw new Error("missing");
  const layers = tsMod.getLayers({
    edges: [["a", "c"], ["b", "c"]],
  });
  if (layers.length < 2) throw new Error(`expected >=2 layers, got ${layers.length}`);
  // a and b should be in same layer (no deps), c in next
  const firstLayer = layers[0];
  if (!firstLayer.includes("a") || !firstLayer.includes("b")) throw new Error("a,b should be first");
});

console.log("\n\x1b[36m  Part 2: Dependency Resolver\x1b[0m");
const drLib = join(process.cwd(), "tools/ogu/commands/lib/dependency-resolver.mjs");
assert("dependency-resolver.mjs exists", () => { if (!existsSync(drLib)) throw new Error("file missing"); });
const drMod = await import(drLib);

assert("createDependencyResolver returns resolver", () => {
  if (typeof drMod.createDependencyResolver !== "function") throw new Error("missing");
  const dr = drMod.createDependencyResolver();
  if (typeof dr.addDependency !== "function") throw new Error("missing addDependency");
  if (typeof dr.resolve !== "function") throw new Error("missing resolve");
});

assert("resolve returns ordered list", () => {
  const dr = drMod.createDependencyResolver();
  dr.addDependency("app", "db");
  dr.addDependency("app", "cache");
  dr.addDependency("db", "config");
  const result = dr.resolve("app");
  if (!Array.isArray(result.order)) throw new Error("missing order");
  const configIdx = result.order.indexOf("config");
  const dbIdx = result.order.indexOf("db");
  const appIdx = result.order.indexOf("app");
  if (configIdx > dbIdx || dbIdx > appIdx) throw new Error("wrong order");
});

assert("resolve detects circular", () => {
  const dr = drMod.createDependencyResolver();
  dr.addDependency("a", "b");
  dr.addDependency("b", "a");
  const result = dr.resolve("a");
  if (!result.circular) throw new Error("should detect circular");
});

assert("resolve handles no dependencies", () => {
  const dr = drMod.createDependencyResolver();
  const result = dr.resolve("standalone");
  if (result.order.length !== 1) throw new Error("should just have itself");
  if (result.order[0] !== "standalone") throw new Error("should be standalone");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
