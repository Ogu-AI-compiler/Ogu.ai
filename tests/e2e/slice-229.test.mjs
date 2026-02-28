/**
 * Slice 229 — Spatial Index + Geo Hash
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 229 — Spatial Index + Geo Hash\x1b[0m\n");

console.log("\x1b[36m  Part 1: Spatial Index\x1b[0m");
const siLib = join(process.cwd(), "tools/ogu/commands/lib/spatial-index.mjs");
assert("spatial-index.mjs exists", () => { if (!existsSync(siLib)) throw new Error("missing"); });
const siMod = await import(siLib);
assert("insert and queryRadius", () => {
  const si = siMod.createSpatialIndex();
  si.insert("A", 0, 0);
  si.insert("B", 10, 10);
  si.insert("C", 100, 100);
  const nearby = si.queryRadius(0, 0, 15);
  if (nearby.length !== 2) throw new Error(`expected 2, got ${nearby.length}`);
});
assert("getAll returns all", () => {
  const si = siMod.createSpatialIndex();
  si.insert("X", 1, 1);
  si.insert("Y", 2, 2);
  if (si.getAll().length !== 2) throw new Error("expected 2");
});

console.log("\n\x1b[36m  Part 2: Geo Hash\x1b[0m");
const ghLib = join(process.cwd(), "tools/ogu/commands/lib/geo-hash.mjs");
assert("geo-hash.mjs exists", () => { if (!existsSync(ghLib)) throw new Error("missing"); });
const ghMod = await import(ghLib);
assert("encode returns string hash", () => {
  const hash = ghMod.encode(37.7749, -122.4194, 6);
  if (typeof hash !== "string") throw new Error("should be string");
  if (hash.length !== 6) throw new Error(`expected length 6, got ${hash.length}`);
});
assert("decode returns approximate coords", () => {
  const hash = ghMod.encode(37.7749, -122.4194, 6);
  const { lat, lng } = ghMod.decode(hash);
  if (Math.abs(lat - 37.7749) > 0.1) throw new Error("lat too far");
  if (Math.abs(lng - (-122.4194)) > 0.1) throw new Error("lng too far");
});
assert("nearby locations have common prefix", () => {
  const h1 = ghMod.encode(37.7749, -122.4194, 6);
  const h2 = ghMod.encode(37.7750, -122.4195, 6);
  if (h1.substring(0, 4) !== h2.substring(0, 4)) throw new Error("nearby should share prefix");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
