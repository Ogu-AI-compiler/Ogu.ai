/**
 * Slice 157 — Ring Buffer + Circular Buffer
 *
 * Ring Buffer: fixed-size circular buffer with O(1) wraparound.
 * Circular Buffer: auto-resizing circular buffer.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 157 — Ring Buffer + Circular Buffer\x1b[0m\n");

// ── Part 1: Ring Buffer ──────────────────────────────

console.log("\x1b[36m  Part 1: Ring Buffer\x1b[0m");

const rbLib = join(process.cwd(), "tools/ogu/commands/lib/ring-buffer.mjs");
assert("ring-buffer.mjs exists", () => {
  if (!existsSync(rbLib)) throw new Error("file missing");
});

const rbMod = await import(rbLib);

assert("createRingBuffer returns buffer", () => {
  if (typeof rbMod.createRingBuffer !== "function") throw new Error("missing");
  const buf = rbMod.createRingBuffer(4);
  if (typeof buf.push !== "function") throw new Error("missing push");
  if (typeof buf.read !== "function") throw new Error("missing read");
  if (typeof buf.size !== "function") throw new Error("missing size");
});

assert("push and read work", () => {
  const buf = rbMod.createRingBuffer(4);
  buf.push("a");
  buf.push("b");
  if (buf.read() !== "a") throw new Error("should read a");
  if (buf.read() !== "b") throw new Error("should read b");
});

assert("wraps around when full", () => {
  const buf = rbMod.createRingBuffer(3);
  buf.push("a");
  buf.push("b");
  buf.push("c");
  buf.push("d"); // overwrites a
  if (buf.size() !== 3) throw new Error(`expected 3, got ${buf.size()}`);
  if (buf.read() !== "b") throw new Error("should read b after wrap");
});

assert("read from empty returns undefined", () => {
  const buf = rbMod.createRingBuffer(3);
  if (buf.read() !== undefined) throw new Error("should return undefined");
});

assert("toArray returns items in order", () => {
  const buf = rbMod.createRingBuffer(3);
  buf.push(1);
  buf.push(2);
  buf.push(3);
  buf.push(4); // wraps
  const arr = buf.toArray();
  if (arr.length !== 3) throw new Error(`expected 3, got ${arr.length}`);
  if (arr[0] !== 2) throw new Error(`expected 2, got ${arr[0]}`);
});

// ── Part 2: Circular Buffer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Circular Buffer\x1b[0m");

const cbLib = join(process.cwd(), "tools/ogu/commands/lib/circular-buffer.mjs");
assert("circular-buffer.mjs exists", () => {
  if (!existsSync(cbLib)) throw new Error("file missing");
});

const cbMod = await import(cbLib);

assert("createCircularBuffer returns buffer", () => {
  if (typeof cbMod.createCircularBuffer !== "function") throw new Error("missing");
  const buf = cbMod.createCircularBuffer({ initialCapacity: 4 });
  if (typeof buf.push !== "function") throw new Error("missing push");
  if (typeof buf.shift !== "function") throw new Error("missing shift");
});

assert("push and shift work", () => {
  const buf = cbMod.createCircularBuffer({ initialCapacity: 4 });
  buf.push("x");
  buf.push("y");
  if (buf.shift() !== "x") throw new Error("should shift x");
  if (buf.shift() !== "y") throw new Error("should shift y");
});

assert("auto-resizes when full", () => {
  const buf = cbMod.createCircularBuffer({ initialCapacity: 2 });
  buf.push("a");
  buf.push("b");
  buf.push("c"); // triggers resize
  if (buf.size() !== 3) throw new Error(`expected 3, got ${buf.size()}`);
  if (buf.shift() !== "a") throw new Error("should shift a");
});

assert("shift from empty returns undefined", () => {
  const buf = cbMod.createCircularBuffer({ initialCapacity: 2 });
  if (buf.shift() !== undefined) throw new Error("should return undefined");
});

assert("getCapacity reflects growth", () => {
  const buf = cbMod.createCircularBuffer({ initialCapacity: 2 });
  if (buf.getCapacity() !== 2) throw new Error("should start at 2");
  buf.push(1); buf.push(2); buf.push(3);
  if (buf.getCapacity() < 3) throw new Error("should have grown");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
