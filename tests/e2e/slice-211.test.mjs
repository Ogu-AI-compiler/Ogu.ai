/**
 * Slice 211 — Union-Find + Disjoint Set
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 211 — Union-Find + Disjoint Set\x1b[0m\n");

console.log("\x1b[36m  Part 1: Union-Find\x1b[0m");
const ufLib = join(process.cwd(), "tools/ogu/commands/lib/union-find.mjs");
assert("union-find.mjs exists", () => { if (!existsSync(ufLib)) throw new Error("missing"); });
const ufMod = await import(ufLib);
assert("find returns element itself initially", () => {
  const uf = ufMod.createUnionFind();
  uf.makeSet("a"); uf.makeSet("b");
  if (uf.find("a") !== "a") throw new Error("should be a");
});
assert("union merges sets", () => {
  const uf = ufMod.createUnionFind();
  uf.makeSet("a"); uf.makeSet("b");
  uf.union("a", "b");
  if (uf.find("a") !== uf.find("b")) throw new Error("should be same set");
});
assert("connected checks membership", () => {
  const uf = ufMod.createUnionFind();
  uf.makeSet("x"); uf.makeSet("y"); uf.makeSet("z");
  uf.union("x", "y");
  if (!uf.connected("x", "y")) throw new Error("should be connected");
  if (uf.connected("x", "z")) throw new Error("should not be connected");
});

console.log("\n\x1b[36m  Part 2: Disjoint Set\x1b[0m");
const dsLib = join(process.cwd(), "tools/ogu/commands/lib/disjoint-set.mjs");
assert("disjoint-set.mjs exists", () => { if (!existsSync(dsLib)) throw new Error("missing"); });
const dsMod = await import(dsLib);
assert("add and getSetCount", () => {
  const ds = dsMod.createDisjointSet();
  ds.add(1); ds.add(2); ds.add(3);
  if (ds.getSetCount() !== 3) throw new Error("expected 3");
});
assert("merge reduces set count", () => {
  const ds = dsMod.createDisjointSet();
  ds.add(1); ds.add(2); ds.add(3);
  ds.merge(1, 2);
  if (ds.getSetCount() !== 2) throw new Error("expected 2");
});
assert("sameSet checks membership", () => {
  const ds = dsMod.createDisjointSet();
  ds.add("a"); ds.add("b");
  ds.merge("a", "b");
  if (!ds.sameSet("a", "b")) throw new Error("should be same");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
