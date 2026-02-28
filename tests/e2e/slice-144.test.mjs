/**
 * Slice 144 — Rate Limiter + Circuit Breaker
 *
 * Rate Limiter: token bucket rate limiting for API/LLM calls.
 * Circuit Breaker: protect against cascading failures.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 144 — Rate Limiter + Circuit Breaker\x1b[0m\n");

// ── Part 1: Rate Limiter ──────────────────────────────

console.log("\x1b[36m  Part 1: Rate Limiter\x1b[0m");

const rlLib = join(process.cwd(), "tools/ogu/commands/lib/rate-limiter.mjs");
assert("rate-limiter.mjs exists", () => {
  if (!existsSync(rlLib)) throw new Error("file missing");
});

const rlMod = await import(rlLib);

assert("createRateLimiter returns limiter", () => {
  if (typeof rlMod.createRateLimiter !== "function") throw new Error("missing");
  const limiter = rlMod.createRateLimiter({ maxTokens: 10, refillRate: 1 });
  if (typeof limiter.tryAcquire !== "function") throw new Error("missing tryAcquire");
  if (typeof limiter.getTokens !== "function") throw new Error("missing getTokens");
});

assert("tryAcquire succeeds within limit", () => {
  const limiter = rlMod.createRateLimiter({ maxTokens: 5, refillRate: 0 });
  if (!limiter.tryAcquire()) throw new Error("should succeed");
  if (!limiter.tryAcquire()) throw new Error("should succeed (2)");
});

assert("tryAcquire fails when exhausted", () => {
  const limiter = rlMod.createRateLimiter({ maxTokens: 2, refillRate: 0 });
  limiter.tryAcquire();
  limiter.tryAcquire();
  if (limiter.tryAcquire()) throw new Error("should fail when exhausted");
});

assert("getTokens returns remaining", () => {
  const limiter = rlMod.createRateLimiter({ maxTokens: 5, refillRate: 0 });
  if (limiter.getTokens() !== 5) throw new Error("should start full");
  limiter.tryAcquire();
  if (limiter.getTokens() !== 4) throw new Error("should be 4");
});

assert("tryAcquire with cost consumes multiple", () => {
  const limiter = rlMod.createRateLimiter({ maxTokens: 10, refillRate: 0 });
  if (!limiter.tryAcquire(3)) throw new Error("should succeed for 3");
  if (limiter.getTokens() !== 7) throw new Error(`expected 7, got ${limiter.getTokens()}`);
  if (limiter.tryAcquire(8)) throw new Error("should fail for 8");
});

// ── Part 2: Circuit Breaker ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Circuit Breaker\x1b[0m");

const cbLib = join(process.cwd(), "tools/ogu/commands/lib/circuit-breaker.mjs");
assert("circuit-breaker.mjs exists", () => {
  if (!existsSync(cbLib)) throw new Error("file missing");
});

const cbMod = await import(cbLib);

assert("createCircuitBreaker returns breaker", () => {
  if (typeof cbMod.createCircuitBreaker !== "function") throw new Error("missing");
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 3, resetTimeout: 1000 });
  if (typeof cb.execute !== "function") throw new Error("missing execute");
  if (typeof cb.getState !== "function") throw new Error("missing getState");
});

assert("starts in closed state", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  if (cb.getState().state !== "closed") throw new Error(`expected closed, got ${cb.getState().state}`);
});

assert("opens after threshold failures", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 60000 });
  cb.recordFailure();
  cb.recordFailure();
  if (cb.getState().state !== "open") throw new Error(`expected open, got ${cb.getState().state}`);
});

assert("rejects calls when open", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000 });
  cb.recordFailure();
  const result = cb.execute(() => "ok");
  if (!result.rejected) throw new Error("should reject when open");
});

assert("successful calls reset failure count", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 60000 });
  cb.recordFailure();
  cb.recordSuccess();
  if (cb.getState().state !== "closed") throw new Error("success should keep closed");
});

assert("getStats returns failure count", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 60000 });
  cb.recordFailure();
  const stats = cb.getStats();
  if (stats.failures !== 1) throw new Error(`expected 1 failure, got ${stats.failures}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
