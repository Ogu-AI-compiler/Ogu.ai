/**
 * Slice 179 — Heap Allocator + Memory Arena
 *
 * Heap Allocator: simulate heap allocation with compaction.
 * Memory Arena: arena-based bulk allocation with instant free.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 179 — Heap Allocator + Memory Arena\x1b[0m\n");

console.log("\x1b[36m  Part 1: Heap Allocator\x1b[0m");

const haLib = join(process.cwd(), "tools/ogu/commands/lib/heap-allocator.mjs");
assert("heap-allocator.mjs exists", () => { if (!existsSync(haLib)) throw new Error("file missing"); });
const haMod = await import(haLib);

assert("createHeapAllocator returns allocator", () => {
  if (typeof haMod.createHeapAllocator !== "function") throw new Error("missing");
  const h = haMod.createHeapAllocator({ totalSize: 1024 });
  if (typeof h.alloc !== "function") throw new Error("missing alloc");
  if (typeof h.free !== "function") throw new Error("missing free");
});

assert("alloc returns block with offset", () => {
  const h = haMod.createHeapAllocator({ totalSize: 1024 });
  const block = h.alloc(256);
  if (block.offset !== 0) throw new Error(`expected 0, got ${block.offset}`);
  if (block.size !== 256) throw new Error(`expected 256, got ${block.size}`);
});

assert("alloc returns null when full", () => {
  const h = haMod.createHeapAllocator({ totalSize: 100 });
  h.alloc(100);
  const block = h.alloc(1);
  if (block !== null) throw new Error("should return null");
});

assert("free releases memory", () => {
  const h = haMod.createHeapAllocator({ totalSize: 256 });
  const b = h.alloc(256);
  h.free(b.id);
  if (h.getStats().used !== 0) throw new Error("should be 0 used");
});

console.log("\n\x1b[36m  Part 2: Memory Arena\x1b[0m");

const maLib = join(process.cwd(), "tools/ogu/commands/lib/memory-arena.mjs");
assert("memory-arena.mjs exists", () => { if (!existsSync(maLib)) throw new Error("file missing"); });
const maMod = await import(maLib);

assert("createArena returns arena", () => {
  if (typeof maMod.createArena !== "function") throw new Error("missing");
  const arena = maMod.createArena({ capacity: 1024 });
  if (typeof arena.alloc !== "function") throw new Error("missing alloc");
  if (typeof arena.reset !== "function") throw new Error("missing reset");
});

assert("alloc bumps pointer", () => {
  const arena = maMod.createArena({ capacity: 1024 });
  const a = arena.alloc(100);
  const b = arena.alloc(200);
  if (a.offset !== 0) throw new Error("first should be 0");
  if (b.offset !== 100) throw new Error(`second should be 100, got ${b.offset}`);
});

assert("reset frees all at once", () => {
  const arena = maMod.createArena({ capacity: 1024 });
  arena.alloc(500);
  arena.alloc(400);
  arena.reset();
  if (arena.getStats().used !== 0) throw new Error("should be 0 after reset");
});

assert("alloc fails when over capacity", () => {
  const arena = maMod.createArena({ capacity: 100 });
  arena.alloc(60);
  const b = arena.alloc(60);
  if (b !== null) throw new Error("should return null");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
