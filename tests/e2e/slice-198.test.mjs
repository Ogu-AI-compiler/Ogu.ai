/**
 * Slice 198 — Checksum Calculator + Data Integrity Verifier
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 198 — Checksum Calculator + Data Integrity Verifier\x1b[0m\n");

console.log("\x1b[36m  Part 1: Checksum Calculator\x1b[0m");
const ccLib = join(process.cwd(), "tools/ogu/commands/lib/checksum-calculator.mjs");
assert("checksum-calculator.mjs exists", () => { if (!existsSync(ccLib)) throw new Error("missing"); });
const ccMod = await import(ccLib);
assert("crc32 returns consistent hash", () => {
  const a = ccMod.crc32("hello");
  const b = ccMod.crc32("hello");
  if (a !== b) throw new Error("should be deterministic");
});
assert("different inputs give different checksums", () => {
  const a = ccMod.crc32("hello");
  const b = ccMod.crc32("world");
  if (a === b) throw new Error("should differ");
});
assert("adler32 works", () => {
  const result = ccMod.adler32("hello");
  if (typeof result !== "number") throw new Error("should return number");
});

console.log("\n\x1b[36m  Part 2: Data Integrity Verifier\x1b[0m");
const divLib = join(process.cwd(), "tools/ogu/commands/lib/data-integrity-verifier.mjs");
assert("data-integrity-verifier.mjs exists", () => { if (!existsSync(divLib)) throw new Error("missing"); });
const divMod = await import(divLib);
assert("sign and verify pass for unchanged data", () => {
  const v = divMod.createIntegrityVerifier();
  const signed = v.sign("my data");
  if (!v.verify("my data", signed)) throw new Error("should verify");
});
assert("verify fails for tampered data", () => {
  const v = divMod.createIntegrityVerifier();
  const signed = v.sign("my data");
  if (v.verify("tampered", signed)) throw new Error("should fail");
});
assert("getStats tracks operations", () => {
  const v = divMod.createIntegrityVerifier();
  v.sign("a"); v.sign("b");
  const s = v.getStats();
  if (s.signed !== 2) throw new Error(`expected 2, got ${s.signed}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
