/**
 * Slice 199 — Buffer Manager + Page Cache
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 199 — Buffer Manager + Page Cache\x1b[0m\n");

console.log("\x1b[36m  Part 1: Buffer Manager\x1b[0m");
const bmLib = join(process.cwd(), "tools/ogu/commands/lib/buffer-manager.mjs");
assert("buffer-manager.mjs exists", () => { if (!existsSync(bmLib)) throw new Error("missing"); });
const bmMod = await import(bmLib);
assert("allocate and read buffers", () => {
  const bm = bmMod.createBufferManager({ poolSize: 3 });
  const id = bm.allocate(64);
  if (!id) throw new Error("should return buffer id");
  const buf = bm.get(id);
  if (!buf) throw new Error("should get buffer");
});
assert("release returns buffer to pool", () => {
  const bm = bmMod.createBufferManager({ poolSize: 2 });
  const id1 = bm.allocate(32);
  bm.release(id1);
  const stats = bm.getStats();
  if (stats.allocated !== 0) throw new Error(`expected 0 allocated, got ${stats.allocated}`);
});
assert("returns null when pool exhausted", () => {
  const bm = bmMod.createBufferManager({ poolSize: 1 });
  bm.allocate(32);
  if (bm.allocate(32) !== null) throw new Error("should return null");
});

console.log("\n\x1b[36m  Part 2: Page Cache\x1b[0m");
const pcLib = join(process.cwd(), "tools/ogu/commands/lib/page-cache.mjs");
assert("page-cache.mjs exists", () => { if (!existsSync(pcLib)) throw new Error("missing"); });
const pcMod = await import(pcLib);
assert("put and get pages", () => {
  const pc = pcMod.createPageCache({ maxPages: 10 });
  pc.put(1, { data: "page1" });
  const page = pc.get(1);
  if (page.data !== "page1") throw new Error("wrong data");
});
assert("evicts when full", () => {
  const pc = pcMod.createPageCache({ maxPages: 2 });
  pc.put(1, { data: "a" }); pc.put(2, { data: "b" }); pc.put(3, { data: "c" });
  if (pc.get(1) !== null) throw new Error("page 1 should be evicted");
  if (!pc.get(3)) throw new Error("page 3 should exist");
});
assert("getStats reports hits and misses", () => {
  const pc = pcMod.createPageCache({ maxPages: 5 });
  pc.put(1, {}); pc.get(1); pc.get(999);
  const s = pc.getStats();
  if (s.hits !== 1) throw new Error(`expected 1 hit, got ${s.hits}`);
  if (s.misses !== 1) throw new Error(`expected 1 miss, got ${s.misses}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
