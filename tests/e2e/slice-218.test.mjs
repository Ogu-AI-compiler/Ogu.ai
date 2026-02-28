/**
 * Slice 218 — TopK Tracker + Reservoir Sampler
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 218 — TopK Tracker + Reservoir Sampler\x1b[0m\n");

console.log("\x1b[36m  Part 1: TopK Tracker\x1b[0m");
const tkLib = join(process.cwd(), "tools/ogu/commands/lib/topk-tracker.mjs");
assert("topk-tracker.mjs exists", () => { if (!existsSync(tkLib)) throw new Error("missing"); });
const tkMod = await import(tkLib);
assert("tracks top K elements", () => {
  const tk = tkMod.createTopKTracker(3);
  tk.add(5); tk.add(3); tk.add(8); tk.add(1); tk.add(9);
  const top = tk.getTop();
  if (top.length !== 3) throw new Error(`expected 3, got ${top.length}`);
  if (top[0] !== 9) throw new Error("highest should be 9");
});
assert("handles fewer than K elements", () => {
  const tk = tkMod.createTopKTracker(5);
  tk.add(1); tk.add(2);
  if (tk.getTop().length !== 2) throw new Error("expected 2");
});
assert("getMin returns smallest in top-K", () => {
  const tk = tkMod.createTopKTracker(3);
  tk.add(10); tk.add(20); tk.add(30); tk.add(5);
  if (tk.getMin() !== 10) throw new Error(`expected 10, got ${tk.getMin()}`);
});

console.log("\n\x1b[36m  Part 2: Reservoir Sampler\x1b[0m");
const rsLib = join(process.cwd(), "tools/ogu/commands/lib/reservoir-sampler.mjs");
assert("reservoir-sampler.mjs exists", () => { if (!existsSync(rsLib)) throw new Error("missing"); });
const rsMod = await import(rsLib);
assert("sample maintains correct size", () => {
  const rs = rsMod.createReservoirSampler(5);
  for (let i = 0; i < 100; i++) rs.add(i);
  if (rs.getSample().length !== 5) throw new Error("expected 5");
});
assert("sample contains valid elements", () => {
  const rs = rsMod.createReservoirSampler(3);
  for (let i = 0; i < 10; i++) rs.add(i);
  const sample = rs.getSample();
  for (const v of sample) {
    if (v < 0 || v >= 10) throw new Error(`invalid value: ${v}`);
  }
});
assert("getCount tracks total", () => {
  const rs = rsMod.createReservoirSampler(2);
  rs.add("a"); rs.add("b"); rs.add("c");
  if (rs.getCount() !== 3) throw new Error("expected 3");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
