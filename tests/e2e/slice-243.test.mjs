/**
 * Slice 243 — Cache Coherence Protocol + Write Buffer
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 243 — Cache Coherence Protocol + Write Buffer\x1b[0m\n");
console.log("\x1b[36m  Part 1: Cache Coherence Protocol\x1b[0m");
const ccLib = join(process.cwd(), "tools/ogu/commands/lib/cache-coherence-protocol.mjs");
assert("cache-coherence-protocol.mjs exists", () => { if (!existsSync(ccLib)) throw new Error("missing"); });
const ccMod = await import(ccLib);
assert("MESI states transition correctly", () => {
  const cc = ccMod.createCacheCoherence();
  cc.read("addr1", "cpu0");
  if (cc.getState("addr1","cpu0")!=="shared") throw new Error("should be shared after read");
  cc.write("addr1", "cpu0");
  if (cc.getState("addr1","cpu0")!=="modified") throw new Error("should be modified after write");
});
assert("other caches invalidated on write", () => {
  const cc = ccMod.createCacheCoherence();
  cc.read("addr1", "cpu0"); cc.read("addr1", "cpu1");
  cc.write("addr1", "cpu0");
  if (cc.getState("addr1","cpu1")!=="invalid") throw new Error("cpu1 should be invalid");
});
console.log("\n\x1b[36m  Part 2: Write Buffer\x1b[0m");
const wbLib = join(process.cwd(), "tools/ogu/commands/lib/write-buffer.mjs");
assert("write-buffer.mjs exists", () => { if (!existsSync(wbLib)) throw new Error("missing"); });
const wbMod = await import(wbLib);
assert("buffer and flush", () => {
  const wb = wbMod.createWriteBuffer(4);
  wb.write("addr1", 10); wb.write("addr2", 20);
  const flushed = wb.flush();
  if (flushed.length!==2) throw new Error("expected 2");
});
assert("isFull detects capacity", () => {
  const wb = wbMod.createWriteBuffer(2);
  wb.write("a", 1); wb.write("b", 2);
  if (!wb.isFull()) throw new Error("should be full");
});
console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
