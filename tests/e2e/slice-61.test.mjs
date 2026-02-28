/**
 * Slice 61 — Rate Limiter + Circuit Breaker
 *
 * Rate limiter: token bucket algorithm for API/LLM call throttling.
 * Circuit breaker: failure detection with open/half-open/closed states.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice61-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 61 — Rate Limiter + Circuit Breaker\x1b[0m\n");
console.log("  Token bucket throttling, failure circuit breaking\n");

// ── Part 1: Rate Limiter ──────────────────────────────

console.log("\x1b[36m  Part 1: Rate Limiter\x1b[0m");

const rlLib = join(process.cwd(), "tools/ogu/commands/lib/rate-limiter.mjs");
assert("rate-limiter.mjs exists", () => {
  if (!existsSync(rlLib)) throw new Error("file missing");
});

const rlMod = await import(rlLib);

assert("createRateLimiter returns limiter", () => {
  if (typeof rlMod.createRateLimiter !== "function") throw new Error("missing");
  const rl = rlMod.createRateLimiter({ maxTokens: 10, refillRate: 1 });
  if (typeof rl.tryConsume !== "function") throw new Error("missing tryConsume");
  if (typeof rl.getState !== "function") throw new Error("missing getState");
});

assert("tryConsume allows within limit", () => {
  const rl = rlMod.createRateLimiter({ maxTokens: 5, refillRate: 0 });
  if (!rl.tryConsume(1)) throw new Error("should allow 1");
  if (!rl.tryConsume(2)) throw new Error("should allow 2 more");
  if (!rl.tryConsume(2)) throw new Error("should allow 2 more (total=5)");
});

assert("tryConsume rejects over limit", () => {
  const rl = rlMod.createRateLimiter({ maxTokens: 3, refillRate: 0 });
  rl.tryConsume(3);
  if (rl.tryConsume(1)) throw new Error("should reject (bucket empty)");
});

assert("getState reports current tokens", () => {
  const rl = rlMod.createRateLimiter({ maxTokens: 10, refillRate: 0 });
  rl.tryConsume(4);
  const state = rl.getState();
  if (state.tokens !== 6) throw new Error(`expected 6 tokens, got ${state.tokens}`);
  if (state.maxTokens !== 10) throw new Error("wrong maxTokens");
});

assert("RATE_PRESETS provides standard configs", () => {
  if (!rlMod.RATE_PRESETS) throw new Error("missing");
  if (!rlMod.RATE_PRESETS.api) throw new Error("missing api preset");
  if (!rlMod.RATE_PRESETS.llm) throw new Error("missing llm preset");
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
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  if (typeof cb.execute !== "function") throw new Error("missing execute");
  if (typeof cb.getState !== "function") throw new Error("missing getState");
  if (typeof cb.recordSuccess !== "function") throw new Error("missing recordSuccess");
  if (typeof cb.recordFailure !== "function") throw new Error("missing recordFailure");
});

assert("starts in closed state", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  if (cb.getState().state !== "closed") throw new Error("should start closed");
});

assert("opens after failure threshold", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 60000 });
  cb.recordFailure();
  cb.recordFailure();
  if (cb.getState().state !== "closed") throw new Error("should still be closed after 2");
  cb.recordFailure();
  if (cb.getState().state !== "open") throw new Error("should be open after 3 failures");
});

assert("execute rejects when open", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 60000 });
  cb.recordFailure();
  const result = cb.execute(() => "should not run");
  if (result.executed) throw new Error("should not execute when open");
  if (!result.rejected) throw new Error("should be rejected");
});

assert("execute succeeds when closed", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  const result = cb.execute(() => "hello");
  if (!result.executed) throw new Error("should execute when closed");
  if (result.value !== "hello") throw new Error("should return value");
});

assert("success resets failure count", () => {
  const cb = cbMod.createCircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 1000 });
  cb.recordFailure();
  cb.recordFailure();
  cb.recordSuccess();
  const state = cb.getState();
  if (state.failures !== 0) throw new Error(`expected 0 failures after success, got ${state.failures}`);
});

assert("BREAKER_STATES lists all states", () => {
  if (!cbMod.BREAKER_STATES) throw new Error("missing");
  if (!cbMod.BREAKER_STATES.includes("closed")) throw new Error("missing closed");
  if (!cbMod.BREAKER_STATES.includes("open")) throw new Error("missing open");
  if (!cbMod.BREAKER_STATES.includes("half-open")) throw new Error("missing half-open");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
