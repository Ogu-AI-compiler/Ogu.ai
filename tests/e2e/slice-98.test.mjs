/**
 * Slice 98 — Progress Tracker + ETA Calculator
 *
 * Progress tracker: track multi-step progress with percentage.
 * ETA calculator: estimate time remaining based on velocity.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 98 — Progress Tracker + ETA Calculator\x1b[0m\n");

// ── Part 1: Progress Tracker ──────────────────────────────

console.log("\x1b[36m  Part 1: Progress Tracker\x1b[0m");

const ptLib = join(process.cwd(), "tools/ogu/commands/lib/progress-tracker.mjs");
assert("progress-tracker.mjs exists", () => {
  if (!existsSync(ptLib)) throw new Error("file missing");
});

const ptMod = await import(ptLib);

assert("createProgressTracker returns tracker", () => {
  if (typeof ptMod.createProgressTracker !== "function") throw new Error("missing");
  const pt = ptMod.createProgressTracker({ total: 10 });
  if (typeof pt.increment !== "function") throw new Error("missing increment");
  if (typeof pt.getProgress !== "function") throw new Error("missing getProgress");
});

assert("increment updates progress", () => {
  const pt = ptMod.createProgressTracker({ total: 10 });
  pt.increment();
  pt.increment();
  pt.increment();
  const p = pt.getProgress();
  if (p.completed !== 3) throw new Error(`expected 3, got ${p.completed}`);
  if (p.percentage !== 30) throw new Error(`expected 30%, got ${p.percentage}%`);
});

assert("increment with custom amount", () => {
  const pt = ptMod.createProgressTracker({ total: 100 });
  pt.increment(25);
  if (pt.getProgress().percentage !== 25) throw new Error("wrong percentage");
});

assert("does not exceed 100%", () => {
  const pt = ptMod.createProgressTracker({ total: 5 });
  for (let i = 0; i < 10; i++) pt.increment();
  const p = pt.getProgress();
  if (p.percentage > 100) throw new Error("should not exceed 100%");
});

assert("isComplete returns true when done", () => {
  const pt = ptMod.createProgressTracker({ total: 3 });
  pt.increment(3);
  if (!pt.isComplete()) throw new Error("should be complete");
});

// ── Part 2: ETA Calculator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: ETA Calculator\x1b[0m");

const etaLib = join(process.cwd(), "tools/ogu/commands/lib/eta-calculator.mjs");
assert("eta-calculator.mjs exists", () => {
  if (!existsSync(etaLib)) throw new Error("file missing");
});

const etaMod = await import(etaLib);

assert("createETACalculator returns calculator", () => {
  if (typeof etaMod.createETACalculator !== "function") throw new Error("missing");
  const eta = etaMod.createETACalculator({ total: 100 });
  if (typeof eta.recordProgress !== "function") throw new Error("missing recordProgress");
  if (typeof eta.getETA !== "function") throw new Error("missing getETA");
});

assert("getETA returns estimated remaining time", () => {
  const eta = etaMod.createETACalculator({ total: 100 });
  const now = Date.now();
  eta.recordProgress(10, now);
  eta.recordProgress(20, now + 1000);
  const result = eta.getETA();
  if (typeof result.remainingMs !== "number") throw new Error("missing remainingMs");
  if (result.remainingMs <= 0) throw new Error("should have remaining time");
});

assert("velocity tracks items per second", () => {
  const eta = etaMod.createETACalculator({ total: 100 });
  const now = Date.now();
  eta.recordProgress(0, now);
  eta.recordProgress(50, now + 5000); // 50 items in 5 seconds = 10/s
  const result = eta.getETA();
  if (typeof result.velocity !== "number") throw new Error("missing velocity");
  if (result.velocity < 5 || result.velocity > 15) throw new Error(`unexpected velocity: ${result.velocity}`);
});

assert("formatETA returns human readable string", () => {
  if (typeof etaMod.formatETA !== "function") throw new Error("missing");
  const str = etaMod.formatETA(65000); // 65 seconds
  if (typeof str !== "string") throw new Error("should return string");
  if (!str.includes("1") || !str.includes("min")) throw new Error(`unexpected format: ${str}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
