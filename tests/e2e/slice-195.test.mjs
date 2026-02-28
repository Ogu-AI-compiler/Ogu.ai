/**
 * Slice 195 — Bit Vector + Bit Manipulation Utils
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 195 — Bit Vector + Bit Manipulation Utils\x1b[0m\n");

console.log("\x1b[36m  Part 1: Bit Vector\x1b[0m");
const bvLib = join(process.cwd(), "tools/ogu/commands/lib/bit-vector.mjs");
assert("bit-vector.mjs exists", () => { if (!existsSync(bvLib)) throw new Error("missing"); });
const bvMod = await import(bvLib);
assert("set and get bits", () => {
  const bv = bvMod.createBitVector(64);
  bv.set(0); bv.set(63);
  if (!bv.get(0)) throw new Error("bit 0 should be set");
  if (!bv.get(63)) throw new Error("bit 63 should be set");
  if (bv.get(1)) throw new Error("bit 1 should not be set");
});
assert("clear unsets bit", () => {
  const bv = bvMod.createBitVector(32);
  bv.set(5); bv.clear(5);
  if (bv.get(5)) throw new Error("should be cleared");
});
assert("popcount counts set bits", () => {
  const bv = bvMod.createBitVector(32);
  bv.set(0); bv.set(1); bv.set(2);
  if (bv.popcount() !== 3) throw new Error(`expected 3, got ${bv.popcount()}`);
});

console.log("\n\x1b[36m  Part 2: Bit Manipulation Utils\x1b[0m");
const buLib = join(process.cwd(), "tools/ogu/commands/lib/bit-utils.mjs");
assert("bit-utils.mjs exists", () => { if (!existsSync(buLib)) throw new Error("missing"); });
const buMod = await import(buLib);
assert("isPowerOfTwo", () => {
  if (!buMod.isPowerOfTwo(8)) throw new Error("8 is power of 2");
  if (buMod.isPowerOfTwo(6)) throw new Error("6 is not");
});
assert("nextPowerOfTwo", () => {
  if (buMod.nextPowerOfTwo(5) !== 8) throw new Error("expected 8");
  if (buMod.nextPowerOfTwo(16) !== 16) throw new Error("expected 16");
});
assert("countBits", () => {
  if (buMod.countBits(7) !== 3) throw new Error("7 has 3 bits");
  if (buMod.countBits(0) !== 0) throw new Error("0 has 0 bits");
});
assert("highestBit", () => {
  if (buMod.highestBit(12) !== 8) throw new Error("expected 8");
  if (buMod.highestBit(1) !== 1) throw new Error("expected 1");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
