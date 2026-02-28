/**
 * Slice 197 — Compression Engine + Run-Length Encoder
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 197 — Compression Engine + Run-Length Encoder\x1b[0m\n");

console.log("\x1b[36m  Part 1: Compression Engine\x1b[0m");
const ceLib = join(process.cwd(), "tools/ogu/commands/lib/compression-engine.mjs");
assert("compression-engine.mjs exists", () => { if (!existsSync(ceLib)) throw new Error("missing"); });
const ceMod = await import(ceLib);
assert("compress and decompress roundtrip", () => {
  const ce = ceMod.createCompressionEngine();
  const input = "hello world hello world hello world";
  const compressed = ce.compress(input);
  const decompressed = ce.decompress(compressed);
  if (decompressed !== input) throw new Error("roundtrip failed");
});
assert("compressed is smaller for repetitive data", () => {
  const ce = ceMod.createCompressionEngine();
  const input = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const compressed = ce.compress(input);
  if (compressed.length >= input.length) throw new Error("should be smaller");
});
assert("getStats returns info", () => {
  const ce = ceMod.createCompressionEngine();
  ce.compress("test data");
  const stats = ce.getStats();
  if (typeof stats.totalCompressed !== "number") throw new Error("missing totalCompressed");
});

console.log("\n\x1b[36m  Part 2: Run-Length Encoder\x1b[0m");
const rleLib = join(process.cwd(), "tools/ogu/commands/lib/run-length-encoder.mjs");
assert("run-length-encoder.mjs exists", () => { if (!existsSync(rleLib)) throw new Error("missing"); });
const rleMod = await import(rleLib);
assert("encode compresses runs", () => {
  const result = rleMod.encode("AAABBBCC");
  if (result !== "3A3B2C") throw new Error(`expected 3A3B2C, got ${result}`);
});
assert("decode restores original", () => {
  const result = rleMod.decode("3A3B2C");
  if (result !== "AAABBBCC") throw new Error(`expected AAABBBCC, got ${result}`);
});
assert("roundtrip works", () => {
  const input = "XXXYYZZZZZ";
  if (rleMod.decode(rleMod.encode(input)) !== input) throw new Error("roundtrip failed");
});
assert("single chars handled", () => {
  const result = rleMod.encode("ABC");
  if (rleMod.decode(result) !== "ABC") throw new Error("single char roundtrip failed");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
