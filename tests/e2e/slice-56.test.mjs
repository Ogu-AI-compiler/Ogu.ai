/**
 * Slice 56 — Event Bus + Retry Queue
 *
 * Event Bus: pub/sub event system for internal communication.
 * Retry Queue: task retry with exponential backoff and dead-letter queue.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice56-${Date.now()}`);
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

console.log("\n\x1b[1mSlice 56 — Event Bus + Retry Queue\x1b[0m\n");
console.log("  Pub/sub events, exponential backoff retries\n");

// ── Part 1: Event Bus ──────────────────────────────

console.log("\x1b[36m  Part 1: Event Bus\x1b[0m");

const busLib = join(process.cwd(), "tools/ogu/commands/lib/event-bus.mjs");
assert("event-bus.mjs exists", () => {
  if (!existsSync(busLib)) throw new Error("file missing");
});

const busMod = await import(busLib);

assert("createEventBus returns bus instance", () => {
  if (typeof busMod.createEventBus !== "function") throw new Error("missing");
  const bus = busMod.createEventBus();
  if (typeof bus.on !== "function") throw new Error("missing on");
  if (typeof bus.off !== "function") throw new Error("missing off");
  if (typeof bus.emit !== "function") throw new Error("missing emit");
  if (typeof bus.once !== "function") throw new Error("missing once");
});

assert("on/emit delivers events to subscribers", () => {
  const bus = busMod.createEventBus();
  const received = [];
  bus.on("test.event", (data) => received.push(data));
  bus.emit("test.event", { value: 42 });
  bus.emit("test.event", { value: 99 });
  if (received.length !== 2) throw new Error(`expected 2, got ${received.length}`);
  if (received[0].value !== 42) throw new Error("wrong first event");
});

assert("off removes subscriber", () => {
  const bus = busMod.createEventBus();
  const received = [];
  const handler = (data) => received.push(data);
  bus.on("x", handler);
  bus.emit("x", 1);
  bus.off("x", handler);
  bus.emit("x", 2);
  if (received.length !== 1) throw new Error(`expected 1, got ${received.length}`);
});

assert("once fires only once", () => {
  const bus = busMod.createEventBus();
  const received = [];
  bus.once("y", (data) => received.push(data));
  bus.emit("y", "a");
  bus.emit("y", "b");
  if (received.length !== 1) throw new Error(`expected 1, got ${received.length}`);
});

assert("wildcard * matches all events", () => {
  const bus = busMod.createEventBus();
  const received = [];
  bus.on("*", (data, type) => received.push(type));
  bus.emit("foo", {});
  bus.emit("bar", {});
  if (received.length !== 2) throw new Error(`expected 2, got ${received.length}`);
  if (!received.includes("foo") || !received.includes("bar")) throw new Error("should include both types");
});

assert("listenerCount returns correct count", () => {
  const bus = busMod.createEventBus();
  if (typeof bus.listenerCount !== "function") throw new Error("missing");
  bus.on("z", () => {});
  bus.on("z", () => {});
  bus.on("w", () => {});
  if (bus.listenerCount("z") !== 2) throw new Error(`expected 2, got ${bus.listenerCount("z")}`);
  if (bus.listenerCount("w") !== 1) throw new Error(`expected 1, got ${bus.listenerCount("w")}`);
});

// ── Part 2: Retry Queue ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Retry Queue\x1b[0m");

const retryLib = join(process.cwd(), "tools/ogu/commands/lib/retry-queue.mjs");
assert("retry-queue.mjs exists", () => {
  if (!existsSync(retryLib)) throw new Error("file missing");
});

const retryMod = await import(retryLib);

assert("createRetryQueue returns queue instance", () => {
  if (typeof retryMod.createRetryQueue !== "function") throw new Error("missing");
  const q = retryMod.createRetryQueue({ maxRetries: 3, baseDelayMs: 100 });
  if (typeof q.enqueue !== "function") throw new Error("missing enqueue");
  if (typeof q.processNext !== "function") throw new Error("missing processNext");
  if (typeof q.getDeadLetters !== "function") throw new Error("missing getDeadLetters");
  if (typeof q.size !== "function") throw new Error("missing size");
});

assert("enqueue adds items to queue", () => {
  const q = retryMod.createRetryQueue({ maxRetries: 3, baseDelayMs: 100 });
  q.enqueue({ id: "t1", payload: "test" });
  q.enqueue({ id: "t2", payload: "test2" });
  if (q.size() !== 2) throw new Error(`expected 2, got ${q.size()}`);
});

assert("processNext succeeds on first try", () => {
  const q = retryMod.createRetryQueue({ maxRetries: 3, baseDelayMs: 10 });
  q.enqueue({ id: "ok-task", payload: "data" });
  const result = q.processNext((item) => ({ success: true, result: "done" }));
  if (!result) throw new Error("should return result");
  if (!result.success) throw new Error("should succeed");
  if (q.size() !== 0) throw new Error("queue should be empty");
});

assert("processNext retries on failure then succeeds", () => {
  const q = retryMod.createRetryQueue({ maxRetries: 3, baseDelayMs: 0 });
  q.enqueue({ id: "flaky-task", payload: "data" });
  let attempts = 0;
  const result = q.processNext((item) => {
    attempts++;
    if (attempts < 3) return { success: false, error: "transient" };
    return { success: true, result: "ok" };
  });
  if (!result.success) throw new Error("should eventually succeed");
  if (attempts !== 3) throw new Error(`expected 3 attempts, got ${attempts}`);
});

assert("processNext sends to dead letter after max retries", () => {
  const q = retryMod.createRetryQueue({ maxRetries: 2, baseDelayMs: 0 });
  q.enqueue({ id: "bad-task", payload: "data" });
  const result = q.processNext(() => ({ success: false, error: "permanent" }));
  if (result.success) throw new Error("should fail");
  const dead = q.getDeadLetters();
  if (dead.length !== 1) throw new Error(`expected 1 dead letter, got ${dead.length}`);
  if (dead[0].id !== "bad-task") throw new Error("wrong dead letter");
});

assert("computeBackoff returns exponential delay", () => {
  if (typeof retryMod.computeBackoff !== "function") throw new Error("missing");
  const d0 = retryMod.computeBackoff(0, 100);
  const d1 = retryMod.computeBackoff(1, 100);
  const d2 = retryMod.computeBackoff(2, 100);
  if (d1 <= d0) throw new Error("delay should increase");
  if (d2 <= d1) throw new Error("delay should keep increasing");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
