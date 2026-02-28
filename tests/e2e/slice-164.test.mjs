/**
 * Slice 164 — Exponential Backoff + Jitter Calculator
 *
 * Exponential Backoff: calculate backoff delays with exponential growth.
 * Jitter Calculator: add controlled randomization to intervals.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 164 — Exponential Backoff + Jitter Calculator\x1b[0m\n");

// ── Part 1: Exponential Backoff ──────────────────────────────

console.log("\x1b[36m  Part 1: Exponential Backoff\x1b[0m");

const ebLib = join(process.cwd(), "tools/ogu/commands/lib/exponential-backoff.mjs");
assert("exponential-backoff.mjs exists", () => {
  if (!existsSync(ebLib)) throw new Error("file missing");
});

const ebMod = await import(ebLib);

assert("createBackoff returns backoff", () => {
  if (typeof ebMod.createBackoff !== "function") throw new Error("missing");
  const bo = ebMod.createBackoff({ baseMs: 100, maxMs: 10000 });
  if (typeof bo.next !== "function") throw new Error("missing next");
  if (typeof bo.reset !== "function") throw new Error("missing reset");
});

assert("first delay is baseMs", () => {
  const bo = ebMod.createBackoff({ baseMs: 100, maxMs: 10000 });
  const delay = bo.next();
  if (delay !== 100) throw new Error(`expected 100, got ${delay}`);
});

assert("delays grow exponentially", () => {
  const bo = ebMod.createBackoff({ baseMs: 100, maxMs: 100000 });
  const d1 = bo.next(); // 100
  const d2 = bo.next(); // 200
  const d3 = bo.next(); // 400
  if (d2 !== 200) throw new Error(`expected 200, got ${d2}`);
  if (d3 !== 400) throw new Error(`expected 400, got ${d3}`);
});

assert("capped at maxMs", () => {
  const bo = ebMod.createBackoff({ baseMs: 1000, maxMs: 5000 });
  bo.next(); // 1000
  bo.next(); // 2000
  bo.next(); // 4000
  const d4 = bo.next(); // would be 8000, capped to 5000
  if (d4 !== 5000) throw new Error(`expected 5000, got ${d4}`);
});

assert("reset restarts sequence", () => {
  const bo = ebMod.createBackoff({ baseMs: 100, maxMs: 10000 });
  bo.next();
  bo.next();
  bo.reset();
  if (bo.next() !== 100) throw new Error("should restart at baseMs");
});

assert("getAttempt returns current attempt", () => {
  const bo = ebMod.createBackoff({ baseMs: 100, maxMs: 10000 });
  if (bo.getAttempt() !== 0) throw new Error("should start at 0");
  bo.next();
  if (bo.getAttempt() !== 1) throw new Error("should be 1 after first next");
});

// ── Part 2: Jitter Calculator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Jitter Calculator\x1b[0m");

const jcLib = join(process.cwd(), "tools/ogu/commands/lib/jitter-calculator.mjs");
assert("jitter-calculator.mjs exists", () => {
  if (!existsSync(jcLib)) throw new Error("file missing");
});

const jcMod = await import(jcLib);

assert("addJitter returns value within range", () => {
  if (typeof jcMod.addJitter !== "function") throw new Error("missing");
  const base = 1000;
  const jitterPct = 0.25; // ±25%
  for (let i = 0; i < 20; i++) {
    const result = jcMod.addJitter(base, jitterPct);
    if (result < base * 0.75 || result > base * 1.25) {
      throw new Error(`${result} out of range [750, 1250]`);
    }
  }
});

assert("fullJitter returns between 0 and value", () => {
  if (typeof jcMod.fullJitter !== "function") throw new Error("missing");
  for (let i = 0; i < 20; i++) {
    const result = jcMod.fullJitter(1000);
    if (result < 0 || result > 1000) {
      throw new Error(`${result} out of range [0, 1000]`);
    }
  }
});

assert("decorrelatedJitter grows with prev", () => {
  if (typeof jcMod.decorrelatedJitter !== "function") throw new Error("missing");
  const result = jcMod.decorrelatedJitter({ baseMs: 100, prevMs: 500 });
  if (result < 100) throw new Error(`should be >= baseMs, got ${result}`);
});

assert("noJitter returns exact value", () => {
  const result = jcMod.addJitter(1000, 0);
  if (result !== 1000) throw new Error("0 jitter should return exact value");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
