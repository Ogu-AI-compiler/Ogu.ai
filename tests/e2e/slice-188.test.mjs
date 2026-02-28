/**
 * Slice 188 — Interval Tree + Range Query Engine
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 188 — Interval Tree + Range Query Engine\x1b[0m\n");

console.log("\x1b[36m  Part 1: Interval Tree\x1b[0m");
const itLib = join(process.cwd(), "tools/ogu/commands/lib/interval-tree.mjs");
assert("interval-tree.mjs exists", () => { if (!existsSync(itLib)) throw new Error("missing"); });
const itMod = await import(itLib);
assert("createIntervalTree works", () => {
  const t = itMod.createIntervalTree();
  t.insert(1, 5, "a"); t.insert(3, 8, "b"); t.insert(10, 15, "c");
  const r = t.query(4);
  if (r.length !== 2) throw new Error(`expected 2, got ${r.length}`);
});
assert("query outside returns empty", () => {
  const t = itMod.createIntervalTree();
  t.insert(1, 5, "a");
  if (t.query(6).length !== 0) throw new Error("should be empty");
});
assert("queryRange finds overlapping", () => {
  const t = itMod.createIntervalTree();
  t.insert(1, 5, "a"); t.insert(4, 8, "b"); t.insert(10, 15, "c");
  const r = t.queryRange(3, 6);
  if (r.length !== 2) throw new Error(`expected 2, got ${r.length}`);
});

console.log("\n\x1b[36m  Part 2: Range Query Engine\x1b[0m");
const rqLib = join(process.cwd(), "tools/ogu/commands/lib/range-query-engine.mjs");
assert("range-query-engine.mjs exists", () => { if (!existsSync(rqLib)) throw new Error("missing"); });
const rqMod = await import(rqLib);
assert("createRangeQueryEngine works", () => {
  const rq = rqMod.createRangeQueryEngine();
  rq.add("a", 10); rq.add("b", 20); rq.add("c", 30); rq.add("d", 5);
  const r = rq.query(8, 25);
  if (r.length !== 2) throw new Error(`expected 2 (a,b), got ${r.length}`);
});
assert("query returns sorted results", () => {
  const rq = rqMod.createRangeQueryEngine();
  rq.add("x", 50); rq.add("y", 10); rq.add("z", 30);
  const r = rq.query(0, 100);
  if (r[0].key !== "y") throw new Error("should be sorted by value");
});
assert("empty range returns empty", () => {
  const rq = rqMod.createRangeQueryEngine();
  rq.add("a", 100);
  if (rq.query(0, 50).length !== 0) throw new Error("should be empty");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
