/**
 * Slice 167 — Semaphore Manager + Barrier Synchronizer
 *
 * Semaphore Manager: resource permits with acquire/release.
 * Barrier Synchronizer: multi-party synchronization.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 167 — Semaphore Manager + Barrier Synchronizer\x1b[0m\n");

// ── Part 1: Semaphore Manager ──────────────────────────────

console.log("\x1b[36m  Part 1: Semaphore Manager\x1b[0m");

const smLib = join(process.cwd(), "tools/ogu/commands/lib/semaphore-manager.mjs");
assert("semaphore-manager.mjs exists", () => {
  if (!existsSync(smLib)) throw new Error("file missing");
});

const smMod = await import(smLib);

assert("createSemaphore returns semaphore", () => {
  if (typeof smMod.createSemaphore !== "function") throw new Error("missing");
  const sem = smMod.createSemaphore(3);
  if (typeof sem.acquire !== "function") throw new Error("missing acquire");
  if (typeof sem.release !== "function") throw new Error("missing release");
  if (typeof sem.available !== "function") throw new Error("missing available");
});

assert("acquire succeeds within permits", () => {
  const sem = smMod.createSemaphore(2);
  if (!sem.acquire()) throw new Error("should succeed");
  if (!sem.acquire()) throw new Error("should succeed (2)");
  if (sem.available() !== 0) throw new Error(`expected 0, got ${sem.available()}`);
});

assert("acquire fails when exhausted", () => {
  const sem = smMod.createSemaphore(1);
  sem.acquire();
  if (sem.acquire()) throw new Error("should fail when exhausted");
});

assert("release restores permits", () => {
  const sem = smMod.createSemaphore(1);
  sem.acquire();
  sem.release();
  if (sem.available() !== 1) throw new Error(`expected 1, got ${sem.available()}`);
  if (!sem.acquire()) throw new Error("should succeed after release");
});

assert("release does not exceed max", () => {
  const sem = smMod.createSemaphore(2);
  sem.release(); // extra release
  if (sem.available() !== 2) throw new Error("should not exceed max permits");
});

// ── Part 2: Barrier Synchronizer ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Barrier Synchronizer\x1b[0m");

const bsLib = join(process.cwd(), "tools/ogu/commands/lib/barrier-synchronizer.mjs");
assert("barrier-synchronizer.mjs exists", () => {
  if (!existsSync(bsLib)) throw new Error("file missing");
});

const bsMod = await import(bsLib);

assert("createBarrier returns barrier", () => {
  if (typeof bsMod.createBarrier !== "function") throw new Error("missing");
  const barrier = bsMod.createBarrier(3);
  if (typeof barrier.arrive !== "function") throw new Error("missing arrive");
  if (typeof barrier.isComplete !== "function") throw new Error("missing isComplete");
  if (typeof barrier.getArrived !== "function") throw new Error("missing getArrived");
});

assert("not complete until all parties arrive", () => {
  const barrier = bsMod.createBarrier(3);
  barrier.arrive("a");
  barrier.arrive("b");
  if (barrier.isComplete()) throw new Error("should not be complete yet");
  if (barrier.getArrived() !== 2) throw new Error(`expected 2, got ${barrier.getArrived()}`);
});

assert("complete when all parties arrive", () => {
  const barrier = bsMod.createBarrier(2);
  barrier.arrive("x");
  barrier.arrive("y");
  if (!barrier.isComplete()) throw new Error("should be complete");
});

assert("duplicate arrivals are ignored", () => {
  const barrier = bsMod.createBarrier(2);
  barrier.arrive("x");
  barrier.arrive("x"); // duplicate
  if (barrier.getArrived() !== 1) throw new Error("duplicate should be ignored");
  if (barrier.isComplete()) throw new Error("should not be complete");
});

assert("reset clears arrivals", () => {
  const barrier = bsMod.createBarrier(2);
  barrier.arrive("a");
  barrier.arrive("b");
  barrier.reset();
  if (barrier.getArrived() !== 0) throw new Error("should be 0 after reset");
  if (barrier.isComplete()) throw new Error("should not be complete after reset");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
