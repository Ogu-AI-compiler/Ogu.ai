/**
 * Slice 30 — Consistency Model + Failure Domains (P30 + P31)
 *
 * Consistency Model: SAGA pattern, transaction boundaries.
 * Failure Domains: resilience strategy, circuit breakers.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice30-${Date.now()}`);
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

console.log("\n\x1b[1mSlice 30 — Consistency Model + Failure Domains (P30 + P31)\x1b[0m\n");
console.log("  SAGA transactions, circuit breakers, resilience strategy\n");

// ── Part 1: SAGA Transaction Manager ──────────────────────────────

console.log("\x1b[36m  Part 1: SAGA Transaction Manager\x1b[0m");

const sagaLib = join(process.cwd(), "tools/ogu/commands/lib/saga-manager.mjs");
assert("saga-manager.mjs exists", () => {
  if (!existsSync(sagaLib)) throw new Error("file missing");
});

const sagaMod = await import(sagaLib);

assert("createSaga initializes a transaction", () => {
  if (typeof sagaMod.createSaga !== "function") throw new Error("missing");
  const saga = sagaMod.createSaga({ name: "deploy-feature" });
  if (!saga.id) throw new Error("no id");
  if (saga.name !== "deploy-feature") throw new Error("wrong name");
  if (saga.status !== "pending") throw new Error("wrong status");
  if (!Array.isArray(saga.steps)) throw new Error("no steps");
});

assert("addStep registers a step with action and compensate", () => {
  if (typeof sagaMod.addStep !== "function") throw new Error("missing");
  const saga = sagaMod.createSaga({ name: "test-saga" });
  let executed = false;
  sagaMod.addStep(saga, {
    name: "step-1",
    action: () => { executed = true; return "done"; },
    compensate: () => { executed = false; },
  });
  if (saga.steps.length !== 1) throw new Error("step not added");
  if (saga.steps[0].name !== "step-1") throw new Error("wrong step name");
});

assert("executeSaga runs all steps in order", async () => {
  if (typeof sagaMod.executeSaga !== "function") throw new Error("missing");
  const saga = sagaMod.createSaga({ name: "ordered-saga" });
  const order = [];
  sagaMod.addStep(saga, {
    name: "s1",
    action: () => { order.push("a1"); },
    compensate: () => { order.push("c1"); },
  });
  sagaMod.addStep(saga, {
    name: "s2",
    action: () => { order.push("a2"); },
    compensate: () => { order.push("c2"); },
  });
  const result = await sagaMod.executeSaga(saga);
  if (result.status !== "completed") throw new Error(`expected completed, got ${result.status}`);
  if (order[0] !== "a1" || order[1] !== "a2") throw new Error(`wrong order: ${order}`);
});

assert("executeSaga compensates on failure (reverse order)", async () => {
  const saga = sagaMod.createSaga({ name: "fail-saga" });
  const order = [];
  sagaMod.addStep(saga, {
    name: "s1",
    action: () => { order.push("a1"); },
    compensate: () => { order.push("c1"); },
  });
  sagaMod.addStep(saga, {
    name: "s2",
    action: () => { throw new Error("boom"); },
    compensate: () => { order.push("c2"); },
  });
  const result = await sagaMod.executeSaga(saga);
  if (result.status !== "compensated") throw new Error(`expected compensated, got ${result.status}`);
  // Compensation runs in reverse: c2 is skipped (failed step), c1 runs
  if (!order.includes("c1")) throw new Error(`missing c1 compensation: ${order}`);
});

assert("saga tracks step results", async () => {
  const saga = sagaMod.createSaga({ name: "tracked" });
  sagaMod.addStep(saga, {
    name: "s1",
    action: () => "result-1",
    compensate: () => {},
  });
  const result = await sagaMod.executeSaga(saga);
  if (!result.stepResults) throw new Error("no stepResults");
  if (result.stepResults[0].result !== "result-1") throw new Error("wrong result");
});

// ── Part 2: Circuit Breaker ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Circuit Breaker\x1b[0m");

const cbLib = join(process.cwd(), "tools/ogu/commands/lib/circuit-breaker.mjs");
assert("circuit-breaker.mjs exists", () => {
  if (!existsSync(cbLib)) throw new Error("file missing");
});

const cbMod = await import(cbLib);

assert("createBreaker returns a circuit breaker", () => {
  if (typeof cbMod.createBreaker !== "function") throw new Error("missing");
  const breaker = cbMod.createBreaker({ name: "api", threshold: 3, resetTimeMs: 1000 });
  if (!breaker.name) throw new Error("no name");
  if (breaker.state !== "closed") throw new Error("should start closed");
});

assert("breaker opens after threshold failures", () => {
  const breaker = cbMod.createBreaker({ name: "test-api", threshold: 2, resetTimeMs: 5000 });
  cbMod.recordFailure(breaker);
  if (breaker.state !== "closed") throw new Error("should still be closed after 1 failure");
  cbMod.recordFailure(breaker);
  if (breaker.state !== "open") throw new Error("should be open after 2 failures");
});

assert("open breaker rejects calls", () => {
  const breaker = cbMod.createBreaker({ name: "reject-api", threshold: 1, resetTimeMs: 60000 });
  cbMod.recordFailure(breaker);
  if (breaker.state !== "open") throw new Error("should be open");
  const allowed = cbMod.isAllowed(breaker);
  if (allowed) throw new Error("should reject when open");
});

assert("breaker transitions to half-open after reset time", () => {
  const breaker = cbMod.createBreaker({ name: "reset-api", threshold: 1, resetTimeMs: 1 });
  cbMod.recordFailure(breaker);
  // Manually set openedAt to past
  breaker.openedAt = Date.now() - 100;
  const allowed = cbMod.isAllowed(breaker);
  if (!allowed) throw new Error("should allow in half-open state");
  if (breaker.state !== "half-open") throw new Error("should be half-open");
});

assert("recordSuccess in half-open closes the breaker", () => {
  const breaker = cbMod.createBreaker({ name: "recover-api", threshold: 1, resetTimeMs: 1 });
  cbMod.recordFailure(breaker);
  breaker.openedAt = Date.now() - 100;
  cbMod.isAllowed(breaker); // transitions to half-open
  cbMod.recordSuccess(breaker);
  if (breaker.state !== "closed") throw new Error(`expected closed, got ${breaker.state}`);
  if (breaker.failureCount !== 0) throw new Error("failure count should reset");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
