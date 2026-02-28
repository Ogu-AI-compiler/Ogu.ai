/**
 * Slice 205 — String Interning + String Pool
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 205 — String Interning + String Pool\x1b[0m\n");

console.log("\x1b[36m  Part 1: String Interning\x1b[0m");
const siLib = join(process.cwd(), "tools/ogu/commands/lib/string-interning.mjs");
assert("string-interning.mjs exists", () => { if (!existsSync(siLib)) throw new Error("missing"); });
const siMod = await import(siLib);
assert("intern returns same reference for same string", () => {
  const interner = siMod.createStringInterner();
  const a = interner.intern("hello");
  const b = interner.intern("hello");
  if (a !== b) throw new Error("should be same reference");
});
assert("different strings get different ids", () => {
  const interner = siMod.createStringInterner();
  const a = interner.intern("foo");
  const b = interner.intern("bar");
  if (a === b) throw new Error("should differ");
});
assert("getCount returns unique count", () => {
  const interner = siMod.createStringInterner();
  interner.intern("a"); interner.intern("b"); interner.intern("a");
  if (interner.getCount() !== 2) throw new Error("expected 2");
});

console.log("\n\x1b[36m  Part 2: String Pool\x1b[0m");
const spLib = join(process.cwd(), "tools/ogu/commands/lib/string-pool.mjs");
assert("string-pool.mjs exists", () => { if (!existsSync(spLib)) throw new Error("missing"); });
const spMod = await import(spLib);
assert("acquire and release", () => {
  const pool = spMod.createStringPool();
  const s = pool.acquire("hello");
  if (s !== "hello") throw new Error("should return string");
  pool.release("hello");
});
assert("deduplicates identical strings", () => {
  const pool = spMod.createStringPool();
  pool.acquire("test"); pool.acquire("test");
  if (pool.getStats().unique !== 1) throw new Error("should be 1 unique");
});
assert("getStats tracks counts", () => {
  const pool = spMod.createStringPool();
  pool.acquire("a"); pool.acquire("b"); pool.acquire("c");
  const stats = pool.getStats();
  if (stats.unique !== 3) throw new Error(`expected 3, got ${stats.unique}`);
  if (stats.total !== 3) throw new Error(`expected total 3, got ${stats.total}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
