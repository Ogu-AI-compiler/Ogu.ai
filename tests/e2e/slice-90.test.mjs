/**
 * Slice 90 — Resource Pool + Backpressure Controller
 *
 * Resource pool: manage pooled resources (connections, threads).
 * Backpressure: flow control when consumers can't keep up.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 90 — Resource Pool + Backpressure Controller\x1b[0m\n");

// ── Part 1: Resource Pool ──────────────────────────────

console.log("\x1b[36m  Part 1: Resource Pool\x1b[0m");

const rpLib = join(process.cwd(), "tools/ogu/commands/lib/resource-pool.mjs");
assert("resource-pool.mjs exists", () => {
  if (!existsSync(rpLib)) throw new Error("file missing");
});

const rpMod = await import(rpLib);

assert("createResourcePool returns pool", () => {
  if (typeof rpMod.createResourcePool !== "function") throw new Error("missing");
  const pool = rpMod.createResourcePool({ maxSize: 3, factory: () => ({ id: Math.random() }) });
  if (typeof pool.acquire !== "function") throw new Error("missing acquire");
  if (typeof pool.release !== "function") throw new Error("missing release");
  if (typeof pool.getStats !== "function") throw new Error("missing getStats");
});

assert("acquire returns a resource", () => {
  const pool = rpMod.createResourcePool({ maxSize: 2, factory: () => ({ value: "conn" }) });
  const res = pool.acquire();
  if (!res || res.value !== "conn") throw new Error("should return resource");
});

assert("release returns resource to pool", () => {
  const pool = rpMod.createResourcePool({ maxSize: 2, factory: () => ({ v: 1 }) });
  const r1 = pool.acquire();
  pool.release(r1);
  const stats = pool.getStats();
  if (stats.available !== 1) throw new Error(`expected 1 available, got ${stats.available}`);
});

assert("pool enforces max size", () => {
  const pool = rpMod.createResourcePool({ maxSize: 2, factory: () => ({}) });
  pool.acquire();
  pool.acquire();
  const r3 = pool.acquire();
  if (r3 !== null) throw new Error("should return null when exhausted");
});

assert("getStats returns pool info", () => {
  const pool = rpMod.createResourcePool({ maxSize: 3, factory: () => ({}) });
  pool.acquire();
  const stats = pool.getStats();
  if (stats.maxSize !== 3) throw new Error("wrong maxSize");
  if (stats.inUse !== 1) throw new Error("wrong inUse");
});

// ── Part 2: Backpressure Controller ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Backpressure Controller\x1b[0m");

const bpLib = join(process.cwd(), "tools/ogu/commands/lib/backpressure-controller.mjs");
assert("backpressure-controller.mjs exists", () => {
  if (!existsSync(bpLib)) throw new Error("file missing");
});

const bpMod = await import(bpLib);

assert("createBackpressure returns controller", () => {
  if (typeof bpMod.createBackpressure !== "function") throw new Error("missing");
  const bp = bpMod.createBackpressure({ highWaterMark: 100 });
  if (typeof bp.push !== "function") throw new Error("missing push");
  if (typeof bp.pull !== "function") throw new Error("missing pull");
  if (typeof bp.shouldPause !== "function") throw new Error("missing shouldPause");
});

assert("shouldPause returns false when under limit", () => {
  const bp = bpMod.createBackpressure({ highWaterMark: 10 });
  bp.push("item1");
  bp.push("item2");
  if (bp.shouldPause()) throw new Error("should not pause with 2/10");
});

assert("shouldPause returns true when at limit", () => {
  const bp = bpMod.createBackpressure({ highWaterMark: 3 });
  bp.push("a");
  bp.push("b");
  bp.push("c");
  if (!bp.shouldPause()) throw new Error("should pause at 3/3");
});

assert("pull removes item and reduces pressure", () => {
  const bp = bpMod.createBackpressure({ highWaterMark: 2 });
  bp.push("a");
  bp.push("b");
  const item = bp.pull();
  if (item !== "a") throw new Error(`expected a, got ${item}`);
  if (bp.shouldPause()) throw new Error("should not pause after pull");
});

assert("getMetrics returns pressure info", () => {
  const bp = bpMod.createBackpressure({ highWaterMark: 100 });
  bp.push("x");
  const m = bp.getMetrics();
  if (typeof m.buffered !== "number") throw new Error("missing buffered");
  if (typeof m.highWaterMark !== "number") throw new Error("missing highWaterMark");
  if (typeof m.pressure !== "number") throw new Error("missing pressure ratio");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
