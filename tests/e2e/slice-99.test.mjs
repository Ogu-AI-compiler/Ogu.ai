/**
 * Slice 99 — Retry Policy + Timeout Manager
 *
 * Retry policy: configurable retry strategies (fixed, exponential, linear).
 * Timeout manager: manage operation timeouts with cancellation.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 99 — Retry Policy + Timeout Manager\x1b[0m\n");

// ── Part 1: Retry Policy ──────────────────────────────

console.log("\x1b[36m  Part 1: Retry Policy\x1b[0m");

const rpLib = join(process.cwd(), "tools/ogu/commands/lib/retry-policy.mjs");
assert("retry-policy.mjs exists", () => {
  if (!existsSync(rpLib)) throw new Error("file missing");
});

const rpMod = await import(rpLib);

assert("createRetryPolicy returns policy", () => {
  if (typeof rpMod.createRetryPolicy !== "function") throw new Error("missing");
  const p = rpMod.createRetryPolicy({ strategy: "fixed", delay: 100, maxRetries: 3 });
  if (typeof p.getDelay !== "function") throw new Error("missing getDelay");
  if (typeof p.shouldRetry !== "function") throw new Error("missing shouldRetry");
});

assert("fixed strategy returns constant delay", () => {
  const p = rpMod.createRetryPolicy({ strategy: "fixed", delay: 1000, maxRetries: 5 });
  if (p.getDelay(1) !== 1000) throw new Error(`expected 1000, got ${p.getDelay(1)}`);
  if (p.getDelay(3) !== 1000) throw new Error(`expected 1000, got ${p.getDelay(3)}`);
});

assert("exponential strategy increases delay", () => {
  const p = rpMod.createRetryPolicy({ strategy: "exponential", delay: 100, maxRetries: 5 });
  const d1 = p.getDelay(1);
  const d2 = p.getDelay(2);
  const d3 = p.getDelay(3);
  if (d2 <= d1) throw new Error("should increase");
  if (d3 <= d2) throw new Error("should increase further");
});

assert("shouldRetry returns false when maxRetries exceeded", () => {
  const p = rpMod.createRetryPolicy({ strategy: "fixed", delay: 100, maxRetries: 2 });
  if (!p.shouldRetry(1)) throw new Error("attempt 1 should retry");
  if (!p.shouldRetry(2)) throw new Error("attempt 2 should retry");
  if (p.shouldRetry(3)) throw new Error("attempt 3 should not retry");
});

assert("RETRY_STRATEGIES exported", () => {
  if (!rpMod.RETRY_STRATEGIES) throw new Error("missing");
  if (!Array.isArray(rpMod.RETRY_STRATEGIES)) throw new Error("should be array");
  if (!rpMod.RETRY_STRATEGIES.includes("exponential")) throw new Error("missing exponential");
});

// ── Part 2: Timeout Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Timeout Manager\x1b[0m");

const tmLib = join(process.cwd(), "tools/ogu/commands/lib/timeout-manager.mjs");
assert("timeout-manager.mjs exists", () => {
  if (!existsSync(tmLib)) throw new Error("file missing");
});

const tmMod = await import(tmLib);

assert("createTimeoutManager returns manager", () => {
  if (typeof tmMod.createTimeoutManager !== "function") throw new Error("missing");
  const tm = tmMod.createTimeoutManager();
  if (typeof tm.setTimeout !== "function") throw new Error("missing setTimeout");
  if (typeof tm.clearTimeout !== "function") throw new Error("missing clearTimeout");
  if (typeof tm.isExpired !== "function") throw new Error("missing isExpired");
});

assert("setTimeout registers timeout", () => {
  const tm = tmMod.createTimeoutManager();
  const id = tm.setTimeout("op1", 5000);
  if (typeof id !== "string") throw new Error("should return id");
  const active = tm.listActive();
  if (active.length !== 1) throw new Error(`expected 1 active, got ${active.length}`);
});

assert("isExpired returns false for fresh timeout", () => {
  const tm = tmMod.createTimeoutManager();
  const id = tm.setTimeout("op", 5000);
  if (tm.isExpired(id)) throw new Error("should not be expired yet");
});

assert("isExpired returns true for past timeout", () => {
  const tm = tmMod.createTimeoutManager();
  const id = tm.setTimeout("op", -1); // Already expired
  if (!tm.isExpired(id)) throw new Error("should be expired");
});

assert("clearTimeout removes timeout", () => {
  const tm = tmMod.createTimeoutManager();
  const id = tm.setTimeout("op", 5000);
  tm.clearTimeout(id);
  if (tm.listActive().length !== 0) throw new Error("should be empty after clear");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
