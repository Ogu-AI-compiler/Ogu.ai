/**
 * Slice 118 — Distributed Runner Protocol + Runner Pool
 *
 * Distributed runner protocol: protocol for remote agent execution.
 * Runner pool: manage pool of runners (local and remote).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 118 — Distributed Runner Protocol + Runner Pool\x1b[0m\n");

// ── Part 1: Distributed Runner Protocol ──────────────────────────────

console.log("\x1b[36m  Part 1: Distributed Runner Protocol\x1b[0m");

const drpLib = join(process.cwd(), "tools/ogu/commands/lib/distributed-runner-protocol.mjs");
assert("distributed-runner-protocol.mjs exists", () => {
  if (!existsSync(drpLib)) throw new Error("file missing");
});

const drpMod = await import(drpLib);

assert("createRunnerProtocol returns protocol", () => {
  if (typeof drpMod.createRunnerProtocol !== "function") throw new Error("missing");
  const p = drpMod.createRunnerProtocol();
  if (typeof p.encodeRequest !== "function") throw new Error("missing encodeRequest");
  if (typeof p.decodeResponse !== "function") throw new Error("missing decodeResponse");
});

assert("encodeRequest produces wire-format message", () => {
  const p = drpMod.createRunnerProtocol();
  const msg = p.encodeRequest({
    taskId: "t-1",
    agentId: "backend-dev",
    command: "build",
    args: { feature: "auth" },
  });
  if (!msg.id) throw new Error("missing id");
  if (msg.version !== 1) throw new Error("wrong version");
  if (msg.command !== "build") throw new Error("wrong command");
});

assert("decodeResponse parses wire-format response", () => {
  const p = drpMod.createRunnerProtocol();
  const resp = p.decodeResponse({
    id: "r-1",
    version: 1,
    status: "success",
    result: { artifacts: ["file.ts"] },
    metrics: { durationMs: 1500 },
  });
  if (resp.status !== "success") throw new Error("wrong status");
  if (resp.result.artifacts[0] !== "file.ts") throw new Error("wrong artifacts");
});

assert("PROTOCOL_COMMANDS lists valid commands", () => {
  if (!Array.isArray(drpMod.PROTOCOL_COMMANDS)) throw new Error("missing");
  const expected = ["execute", "build", "test", "lint", "deploy"];
  for (const c of expected) {
    if (!drpMod.PROTOCOL_COMMANDS.includes(c)) throw new Error(`missing ${c}`);
  }
});

// ── Part 2: Runner Pool ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Runner Pool\x1b[0m");

const rpLib = join(process.cwd(), "tools/ogu/commands/lib/runner-pool.mjs");
assert("runner-pool.mjs exists", () => {
  if (!existsSync(rpLib)) throw new Error("file missing");
});

const rpMod = await import(rpLib);

assert("createRunnerPool returns pool", () => {
  if (typeof rpMod.createRunnerPool !== "function") throw new Error("missing");
  const pool = rpMod.createRunnerPool();
  if (typeof pool.addRunner !== "function") throw new Error("missing addRunner");
  if (typeof pool.acquire !== "function") throw new Error("missing acquire");
  if (typeof pool.release !== "function") throw new Error("missing release");
});

assert("addRunner registers runner with capacity", () => {
  const pool = rpMod.createRunnerPool();
  pool.addRunner("local-1", { type: "local", maxConcurrent: 3 });
  pool.addRunner("remote-1", { type: "remote", maxConcurrent: 5, endpoint: "ws://host:8080" });
  const runners = pool.listRunners();
  if (runners.length !== 2) throw new Error(`expected 2, got ${runners.length}`);
});

assert("acquire assigns task to available runner", () => {
  const pool = rpMod.createRunnerPool();
  pool.addRunner("r1", { type: "local", maxConcurrent: 1 });
  const runner = pool.acquire("task-1");
  if (!runner) throw new Error("should return runner");
  if (runner.runnerId !== "r1") throw new Error(`wrong runner: ${runner.runnerId}`);
});

assert("acquire returns null when all at capacity", () => {
  const pool = rpMod.createRunnerPool();
  pool.addRunner("r1", { type: "local", maxConcurrent: 1 });
  pool.acquire("task-1");
  const second = pool.acquire("task-2");
  if (second !== null) throw new Error("should return null when at capacity");
});

assert("release frees runner capacity", () => {
  const pool = rpMod.createRunnerPool();
  pool.addRunner("r1", { type: "local", maxConcurrent: 1 });
  pool.acquire("task-1");
  pool.release("task-1");
  const next = pool.acquire("task-2");
  if (!next) throw new Error("should be available after release");
});

assert("getPoolStatus shows utilization", () => {
  const pool = rpMod.createRunnerPool();
  pool.addRunner("r1", { type: "local", maxConcurrent: 3 });
  pool.acquire("t1");
  pool.acquire("t2");
  const status = pool.getPoolStatus();
  if (status.totalCapacity !== 3) throw new Error("wrong total capacity");
  if (status.activeJobs !== 2) throw new Error("wrong active jobs");
  if (status.available !== 1) throw new Error("wrong available");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
