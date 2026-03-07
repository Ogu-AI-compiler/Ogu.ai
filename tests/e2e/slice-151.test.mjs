/**
 * Slice 151 — Batch Processor
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 151 — Batch Processor\x1b[0m\n");

console.log("\x1b[36m  Part 1: Batch Processor\x1b[0m");

const bpLib = join(process.cwd(), "tools/ogu/commands/lib/batch-processor.mjs");
assert("batch-processor.mjs exists", () => { if (!existsSync(bpLib)) throw new Error("file missing"); });
const bpMod = await import(bpLib);

assert("createBatchProcessor returns processor", () => {
  if (typeof bpMod.createBatchProcessor !== "function") throw new Error("missing");
  const proc = bpMod.createBatchProcessor({ batchSize: 3 });
  if (typeof proc.add !== "function") throw new Error("missing add");
  if (typeof proc.process !== "function") throw new Error("missing process");
});

assert("process runs handler on batches", async () => {
  const proc = bpMod.createBatchProcessor({ batchSize: 2 });
  proc.add("a"); proc.add("b"); proc.add("c"); proc.add("d"); proc.add("e");
  const batches = [];
  await proc.process(async (batch) => batches.push([...batch]));
  if (batches.length !== 3) throw new Error(`expected 3 batches, got ${batches.length}`);
  if (batches[0].length !== 2) throw new Error("first batch should be 2");
  if (batches[2].length !== 1) throw new Error("last batch should be 1");
});

assert("getStats returns processing stats", async () => {
  const proc = bpMod.createBatchProcessor({ batchSize: 5 });
  proc.add(1); proc.add(2); proc.add(3);
  await proc.process(async () => {});
  const stats = proc.getStats();
  if (stats.totalItems !== 3) throw new Error(`expected 3, got ${stats.totalItems}`);
  if (stats.batchesProcessed !== 1) throw new Error(`expected 1 batch, got ${stats.batchesProcessed}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
