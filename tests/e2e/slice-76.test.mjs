/**
 * Slice 76 — Job Queue + Daemon Registry
 *
 * Job queue: deterministic job scheduling with persistence.
 * Daemon registry: service discovery for runners and daemons.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice76-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 76 — Job Queue + Daemon Registry\x1b[0m\n");

// ── Part 1: Job Queue ──────────────────────────────

console.log("\x1b[36m  Part 1: Job Queue\x1b[0m");

const jqLib = join(process.cwd(), "tools/ogu/commands/lib/job-queue.mjs");
assert("job-queue.mjs exists", () => {
  if (!existsSync(jqLib)) throw new Error("file missing");
});

const jqMod = await import(jqLib);

assert("createJobQueue returns queue", () => {
  if (typeof jqMod.createJobQueue !== "function") throw new Error("missing");
  const q = jqMod.createJobQueue();
  if (typeof q.enqueue !== "function") throw new Error("missing enqueue");
  if (typeof q.dequeue !== "function") throw new Error("missing dequeue");
  if (typeof q.markCompleted !== "function") throw new Error("missing markCompleted");
});

assert("enqueue adds job and dequeue retrieves", () => {
  const q = jqMod.createJobQueue();
  const id = q.enqueue({ taskId: "t1", command: "build" });
  if (typeof id !== "string") throw new Error("should return job id");
  const job = q.dequeue();
  if (!job) throw new Error("should dequeue a job");
  if (job.taskId !== "t1") throw new Error("wrong taskId");
});

assert("FIFO order maintained", () => {
  const q = jqMod.createJobQueue();
  q.enqueue({ taskId: "first" });
  q.enqueue({ taskId: "second" });
  q.enqueue({ taskId: "third" });
  const j1 = q.dequeue();
  const j2 = q.dequeue();
  if (j1.taskId !== "first") throw new Error(`expected first, got ${j1.taskId}`);
  if (j2.taskId !== "second") throw new Error(`expected second, got ${j2.taskId}`);
});

assert("markCompleted removes job from active", () => {
  const q = jqMod.createJobQueue();
  const id = q.enqueue({ taskId: "t1" });
  q.dequeue();
  q.markCompleted(id);
  const stats = q.getStats();
  if (stats.completed !== 1) throw new Error(`expected 1 completed, got ${stats.completed}`);
});

assert("retry re-enqueues a job", () => {
  const q = jqMod.createJobQueue();
  const id = q.enqueue({ taskId: "flaky" });
  q.dequeue();
  q.retry(id);
  const job = q.dequeue();
  if (!job) throw new Error("retried job should be dequeued");
  if (job.retryCount !== 1) throw new Error(`expected retryCount 1, got ${job.retryCount}`);
});

assert("getStats returns queue statistics", () => {
  const q = jqMod.createJobQueue();
  q.enqueue({ taskId: "a" });
  q.enqueue({ taskId: "b" });
  q.dequeue();
  const stats = q.getStats();
  if (typeof stats.pending !== "number") throw new Error("missing pending");
  if (typeof stats.active !== "number") throw new Error("missing active");
  if (stats.pending !== 1) throw new Error(`expected 1 pending, got ${stats.pending}`);
  if (stats.active !== 1) throw new Error(`expected 1 active, got ${stats.active}`);
});

// ── Part 2: Daemon Registry ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Daemon Registry\x1b[0m");

const drLib = join(process.cwd(), "tools/ogu/commands/lib/daemon-registry.mjs");
assert("daemon-registry.mjs exists", () => {
  if (!existsSync(drLib)) throw new Error("file missing");
});

const drMod = await import(drLib);

assert("createDaemonRegistry returns registry", () => {
  if (typeof drMod.createDaemonRegistry !== "function") throw new Error("missing");
  const reg = drMod.createDaemonRegistry();
  if (typeof reg.register !== "function") throw new Error("missing register");
  if (typeof reg.unregister !== "function") throw new Error("missing unregister");
  if (typeof reg.discover !== "function") throw new Error("missing discover");
});

assert("register adds service", () => {
  const reg = drMod.createDaemonRegistry();
  reg.register({ name: "runner-1", type: "runner", host: "localhost", port: 8081 });
  const services = reg.listServices();
  if (services.length !== 1) throw new Error(`expected 1, got ${services.length}`);
  if (services[0].name !== "runner-1") throw new Error("wrong name");
});

assert("discover finds services by type", () => {
  const reg = drMod.createDaemonRegistry();
  reg.register({ name: "r1", type: "runner", host: "localhost", port: 8081 });
  reg.register({ name: "r2", type: "runner", host: "localhost", port: 8082 });
  reg.register({ name: "d1", type: "daemon", host: "localhost", port: 9000 });
  const runners = reg.discover("runner");
  if (runners.length !== 2) throw new Error(`expected 2 runners, got ${runners.length}`);
});

assert("unregister removes service", () => {
  const reg = drMod.createDaemonRegistry();
  reg.register({ name: "s1", type: "runner", host: "localhost", port: 8081 });
  reg.unregister("s1");
  const services = reg.listServices();
  if (services.length !== 0) throw new Error("should be empty after unregister");
});

assert("heartbeat updates last seen", () => {
  const reg = drMod.createDaemonRegistry();
  reg.register({ name: "s1", type: "runner", host: "localhost", port: 8081 });
  reg.heartbeat("s1");
  const svc = reg.getService("s1");
  if (!svc.lastSeen) throw new Error("should have lastSeen");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
