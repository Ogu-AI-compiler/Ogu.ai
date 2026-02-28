/**
 * Slice 154 — Progress Tracker + ETA Calculator
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 154 — Progress Tracker + ETA Calculator\x1b[0m\n");

console.log("\x1b[36m  Part 1: Progress Tracker\x1b[0m");

const ptLib = join(process.cwd(), "tools/ogu/commands/lib/progress-tracker.mjs");
assert("progress-tracker.mjs exists", () => { if (!existsSync(ptLib)) throw new Error("file missing"); });
const ptMod = await import(ptLib);

assert("createProgressTracker returns tracker", () => {
  if (typeof ptMod.createProgressTracker !== "function") throw new Error("missing");
  const tracker = ptMod.createProgressTracker({ total: 10 });
  if (typeof tracker.increment !== "function") throw new Error("missing increment");
  if (typeof tracker.getProgress !== "function") throw new Error("missing getProgress");
});

assert("advance increments progress", () => {
  const tracker = ptMod.createProgressTracker({ total: 10 });
  tracker.increment(3);
  tracker.increment(2);
  const p = tracker.getProgress();
  if (p.completed !== 5) throw new Error(`expected 5, got ${p.completed}`);
  if (p.percentage !== 50) throw new Error(`expected 50%, got ${p.percentage}%`);
});

assert("isComplete returns true at 100%", () => {
  const tracker = ptMod.createProgressTracker({ total: 3 });
  tracker.increment(3);
  if (!tracker.isComplete()) throw new Error("should be complete");
});

assert("getProgress returns remaining", () => {
  const tracker = ptMod.createProgressTracker({ total: 8 });
  tracker.increment(5);
  const p = tracker.getProgress();
  if (p.remaining !== 3) throw new Error(`expected 3, got ${p.remaining}`);
});

console.log("\n\x1b[36m  Part 2: ETA Calculator\x1b[0m");

const etaLib = join(process.cwd(), "tools/ogu/commands/lib/eta-calculator.mjs");
assert("eta-calculator.mjs exists", () => { if (!existsSync(etaLib)) throw new Error("file missing"); });
const etaMod = await import(etaLib);

assert("createETACalculator returns calculator", () => {
  if (typeof etaMod.createETACalculator !== "function") throw new Error("missing");
  const calc = etaMod.createETACalculator({ total: 100 });
  if (typeof calc.recordProgress !== "function") throw new Error("missing recordProgress");
  if (typeof calc.getETA !== "function") throw new Error("missing getETA");
});

assert("getETA returns estimate after progress", () => {
  const calc = etaMod.createETACalculator({ total: 100 });
  calc.recordProgress(10, 1000); // 10 done in 1s
  calc.recordProgress(20, 2000); // 20 done in 2s
  const eta = calc.getETA();
  if (typeof eta.remainingMs !== "number") throw new Error("missing remainingMs");
  if (eta.remainingMs <= 0) throw new Error("should be positive");
});

assert("getETA returns velocity", () => {
  const calc = etaMod.createETACalculator({ total: 50 });
  calc.recordProgress(0, 0);
  calc.recordProgress(25, 5000); // 25 in 5s = 5/s
  const eta = calc.getETA();
  if (typeof eta.velocity !== "number") throw new Error("missing velocity");
  if (eta.velocity <= 0) throw new Error("velocity should be positive");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
