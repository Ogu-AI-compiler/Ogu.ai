/**
 * Slice 191 — Object Pool + Flyweight Factory
 */
import { existsSync } from "node:fs"; import { join } from "node:path";
let pass = 0, fail = 0;
function assert(l, fn) { try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${l}`); } catch(e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${l}: ${e.message}`); } }
console.log("\n\x1b[1mSlice 191 — Object Pool + Flyweight Factory\x1b[0m\n");

console.log("\x1b[36m  Part 1: Object Pool\x1b[0m");
const opLib = join(process.cwd(), "tools/ogu/commands/lib/object-pool.mjs");
assert("object-pool.mjs exists", () => { if (!existsSync(opLib)) throw new Error("missing"); });
const opMod = await import(opLib);
assert("createObjectPool works", () => {
  const pool = opMod.createObjectPool(() => ({ value: 0 }), 3);
  const obj = pool.acquire();
  if (!obj) throw new Error("should get object");
  pool.release(obj);
  if (pool.available() !== 3) throw new Error(`expected 3, got ${pool.available()}`);
});
assert("acquire returns null when exhausted", () => {
  const pool = opMod.createObjectPool(() => ({}), 1);
  pool.acquire();
  if (pool.acquire() !== null) throw new Error("should be null");
});
assert("released objects are reused", () => {
  const pool = opMod.createObjectPool(() => ({ id: Math.random() }), 1);
  const o1 = pool.acquire(); pool.release(o1);
  const o2 = pool.acquire();
  if (o1.id !== o2.id) throw new Error("should reuse");
});

console.log("\n\x1b[36m  Part 2: Flyweight Factory\x1b[0m");
const fwLib = join(process.cwd(), "tools/ogu/commands/lib/flyweight-factory.mjs");
assert("flyweight-factory.mjs exists", () => { if (!existsSync(fwLib)) throw new Error("missing"); });
const fwMod = await import(fwLib);
assert("createFlyweightFactory deduplicates", () => {
  const f = fwMod.createFlyweightFactory();
  const a = f.get("red");
  const b = f.get("red");
  if (a !== b) throw new Error("same key should return same object");
});
assert("different keys get different objects", () => {
  const f = fwMod.createFlyweightFactory();
  const a = f.get("red");
  const b = f.get("blue");
  if (a === b) throw new Error("different keys should differ");
});
assert("getCount tracks unique objects", () => {
  const f = fwMod.createFlyweightFactory();
  f.get("a"); f.get("b"); f.get("a");
  if (f.getCount() !== 2) throw new Error(`expected 2, got ${f.getCount()}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
