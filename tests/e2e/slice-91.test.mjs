/**
 * Slice 91 — Task Queue Persistent + Batch Processor
 *
 * Task queue persistent: file-backed task queue with resume support.
 * Batch processor: process items in configurable batches.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice91-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 91 — Task Queue Persistent + Batch Processor\x1b[0m\n");

// ── Part 1: Task Queue Persistent ──────────────────────────────

console.log("\x1b[36m  Part 1: Task Queue Persistent\x1b[0m");

const tqLib = join(process.cwd(), "tools/ogu/commands/lib/task-queue-persistent.mjs");
assert("task-queue-persistent.mjs exists", () => {
  if (!existsSync(tqLib)) throw new Error("file missing");
});

const tqMod = await import(tqLib);

assert("createPersistentQueue returns queue", () => {
  if (typeof tqMod.createPersistentQueue !== "function") throw new Error("missing");
  const q = tqMod.createPersistentQueue({ path: join(tmp, "queue.jsonl") });
  if (typeof q.enqueue !== "function") throw new Error("missing enqueue");
  if (typeof q.dequeue !== "function") throw new Error("missing dequeue");
  if (typeof q.size !== "function") throw new Error("missing size");
});

assert("enqueue and dequeue work", () => {
  const q = tqMod.createPersistentQueue({ path: join(tmp, "q1.jsonl") });
  q.enqueue({ task: "build" });
  q.enqueue({ task: "test" });
  const item = q.dequeue();
  if (item.task !== "build") throw new Error(`expected build, got ${item.task}`);
  if (q.size() !== 1) throw new Error(`expected 1, got ${q.size()}`);
});

assert("queue persists to file", () => {
  const path = join(tmp, "q2.jsonl");
  const q1 = tqMod.createPersistentQueue({ path });
  q1.enqueue({ task: "a" });
  q1.enqueue({ task: "b" });
  q1.flush(); // Write to disk
  // Load from same file
  const q2 = tqMod.createPersistentQueue({ path });
  if (q2.size() < 2) throw new Error(`expected at least 2 after reload, got ${q2.size()}`);
});

assert("peek shows next without removing", () => {
  const q = tqMod.createPersistentQueue({ path: join(tmp, "q3.jsonl") });
  q.enqueue({ task: "peek-test" });
  const item = q.peek();
  if (item.task !== "peek-test") throw new Error("peek failed");
  if (q.size() !== 1) throw new Error("peek should not remove");
});

// ── Part 2: Batch Processor ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Batch Processor\x1b[0m");

const bpLib = join(process.cwd(), "tools/ogu/commands/lib/batch-processor.mjs");
assert("batch-processor.mjs exists", () => {
  if (!existsSync(bpLib)) throw new Error("file missing");
});

const bpMod = await import(bpLib);

assert("createBatchProcessor returns processor", () => {
  if (typeof bpMod.createBatchProcessor !== "function") throw new Error("missing");
  const bp = bpMod.createBatchProcessor({ batchSize: 3 });
  if (typeof bp.add !== "function") throw new Error("missing add");
  if (typeof bp.process !== "function") throw new Error("missing process");
});

assert("process runs handler on each batch", async () => {
  const batches = [];
  const bp = bpMod.createBatchProcessor({ batchSize: 2 });
  bp.add(1); bp.add(2); bp.add(3); bp.add(4); bp.add(5);
  await bp.process(async (batch) => batches.push([...batch]));
  if (batches.length !== 3) throw new Error(`expected 3 batches, got ${batches.length}`);
  if (batches[0].length !== 2) throw new Error("first batch should be size 2");
  if (batches[2].length !== 1) throw new Error("last batch should be size 1");
});

assert("getStats returns processing info", async () => {
  const bp = bpMod.createBatchProcessor({ batchSize: 5 });
  for (let i = 0; i < 12; i++) bp.add(i);
  await bp.process(async () => {});
  const stats = bp.getStats();
  if (stats.totalItems !== 12) throw new Error(`expected 12, got ${stats.totalItems}`);
  if (stats.batchesProcessed !== 3) throw new Error(`expected 3 batches, got ${stats.batchesProcessed}`);
});

assert("empty processor handles gracefully", async () => {
  const bp = bpMod.createBatchProcessor({ batchSize: 5 });
  let called = false;
  await bp.process(async () => { called = true; });
  if (called) throw new Error("should not call handler for empty");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
