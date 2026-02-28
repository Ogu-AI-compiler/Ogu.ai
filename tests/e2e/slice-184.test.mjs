/**
 * Slice 184 — Bloom Filter + Count-Min Sketch
 *
 * Bloom Filter: probabilistic set membership.
 * Count-Min Sketch: probabilistic frequency estimation.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 184 — Bloom Filter + Count-Min Sketch\x1b[0m\n");

console.log("\x1b[36m  Part 1: Bloom Filter\x1b[0m");
const bfLib = join(process.cwd(), "tools/ogu/commands/lib/bloom-filter.mjs");
assert("bloom-filter.mjs exists", () => { if (!existsSync(bfLib)) throw new Error("file missing"); });
const bfMod = await import(bfLib);

assert("createBloomFilter returns filter", () => {
  if (typeof bfMod.createBloomFilter !== "function") throw new Error("missing");
  const bf = bfMod.createBloomFilter({ size: 1024, hashCount: 3 });
  if (typeof bf.add !== "function") throw new Error("missing add");
  if (typeof bf.mightContain !== "function") throw new Error("missing mightContain");
});

assert("add and mightContain work", () => {
  const bf = bfMod.createBloomFilter({ size: 1024, hashCount: 3 });
  bf.add("hello");
  bf.add("world");
  if (!bf.mightContain("hello")) throw new Error("should contain hello");
  if (!bf.mightContain("world")) throw new Error("should contain world");
});

assert("mightContain returns false for absent items", () => {
  const bf = bfMod.createBloomFilter({ size: 1024, hashCount: 3 });
  bf.add("x");
  // With large enough size, most non-added items should return false
  let falsePositives = 0;
  for (let i = 0; i < 100; i++) {
    if (bf.mightContain(`unique-${i}-${Math.random()}`)) falsePositives++;
  }
  if (falsePositives > 10) throw new Error(`too many false positives: ${falsePositives}`);
});

assert("getStats returns count", () => {
  const bf = bfMod.createBloomFilter({ size: 1024, hashCount: 3 });
  bf.add("a");
  bf.add("b");
  const stats = bf.getStats();
  if (stats.itemsAdded !== 2) throw new Error(`expected 2, got ${stats.itemsAdded}`);
});

console.log("\n\x1b[36m  Part 2: Count-Min Sketch\x1b[0m");
const cmLib = join(process.cwd(), "tools/ogu/commands/lib/count-min-sketch.mjs");
assert("count-min-sketch.mjs exists", () => { if (!existsSync(cmLib)) throw new Error("file missing"); });
const cmMod = await import(cmLib);

assert("createCountMinSketch returns sketch", () => {
  if (typeof cmMod.createCountMinSketch !== "function") throw new Error("missing");
  const cm = cmMod.createCountMinSketch({ width: 100, depth: 3 });
  if (typeof cm.add !== "function") throw new Error("missing add");
  if (typeof cm.estimate !== "function") throw new Error("missing estimate");
});

assert("add and estimate frequency", () => {
  const cm = cmMod.createCountMinSketch({ width: 100, depth: 3 });
  cm.add("apple");
  cm.add("apple");
  cm.add("apple");
  cm.add("banana");
  const appleCount = cm.estimate("apple");
  if (appleCount < 3) throw new Error(`expected >=3, got ${appleCount}`);
  const bananaCount = cm.estimate("banana");
  if (bananaCount < 1) throw new Error(`expected >=1, got ${bananaCount}`);
});

assert("estimate returns 0 for unseen", () => {
  const cm = cmMod.createCountMinSketch({ width: 1000, depth: 5 });
  const count = cm.estimate("never-seen");
  if (count !== 0) throw new Error(`expected 0, got ${count}`);
});

assert("add with count increments by n", () => {
  const cm = cmMod.createCountMinSketch({ width: 100, depth: 3 });
  cm.add("x", 10);
  if (cm.estimate("x") < 10) throw new Error("should be at least 10");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
