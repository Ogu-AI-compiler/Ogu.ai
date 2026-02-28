/**
 * Slice 225 — Network Flow + Max Flow
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 225 — Network Flow + Max Flow\x1b[0m\n");

console.log("\x1b[36m  Part 1: Network Flow\x1b[0m");
const nfLib = join(process.cwd(), "tools/ogu/commands/lib/network-flow.mjs");
assert("network-flow.mjs exists", () => { if (!existsSync(nfLib)) throw new Error("missing"); });
const nfMod = await import(nfLib);
assert("createFlowNetwork adds edges", () => {
  const fn = nfMod.createFlowNetwork();
  fn.addEdge("s", "a", 10);
  fn.addEdge("a", "t", 5);
  const edges = fn.getEdges("s");
  if (edges.length !== 1) throw new Error("expected 1 edge");
  if (edges[0].capacity !== 10) throw new Error("capacity should be 10");
});
assert("getNodes returns all", () => {
  const fn = nfMod.createFlowNetwork();
  fn.addEdge("s", "a", 10);
  fn.addEdge("a", "t", 5);
  if (fn.getNodes().length !== 3) throw new Error("expected 3 nodes");
});

console.log("\n\x1b[36m  Part 2: Max Flow\x1b[0m");
const mfLib = join(process.cwd(), "tools/ogu/commands/lib/max-flow.mjs");
assert("max-flow.mjs exists", () => { if (!existsSync(mfLib)) throw new Error("missing"); });
const mfMod = await import(mfLib);
assert("computes max flow correctly", () => {
  const fn = nfMod.createFlowNetwork();
  fn.addEdge("s", "a", 10);
  fn.addEdge("s", "b", 5);
  fn.addEdge("a", "t", 8);
  fn.addEdge("b", "t", 7);
  const flow = mfMod.maxFlow(fn, "s", "t");
  if (flow !== 13) throw new Error(`expected 13, got ${flow}`);
});
assert("bottleneck limits flow", () => {
  const fn = nfMod.createFlowNetwork();
  fn.addEdge("s", "a", 100);
  fn.addEdge("a", "t", 1);
  const flow = mfMod.maxFlow(fn, "s", "t");
  if (flow !== 1) throw new Error(`expected 1, got ${flow}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
