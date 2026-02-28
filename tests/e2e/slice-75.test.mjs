/**
 * Slice 75 — Runner Interface + Runner Local
 *
 * Runner: abstract runner interface (execute → OutputEnvelope).
 * Runner local: local worktree runner implementation.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice75-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 75 — Runner Interface + Runner Local\x1b[0m\n");

// ── Part 1: Runner Interface ──────────────────────────────

console.log("\x1b[36m  Part 1: Runner Interface\x1b[0m");

const runLib = join(process.cwd(), "tools/ogu/commands/lib/runner.mjs");
assert("runner.mjs exists", () => {
  if (!existsSync(runLib)) throw new Error("file missing");
});

const runMod = await import(runLib);

assert("RUNNER_TYPES exported", () => {
  if (!runMod.RUNNER_TYPES) throw new Error("missing");
  if (!Array.isArray(runMod.RUNNER_TYPES)) throw new Error("should be array");
  if (!runMod.RUNNER_TYPES.includes("local")) throw new Error("missing local");
});

assert("createInputEnvelope builds envelope", () => {
  if (typeof runMod.createInputEnvelope !== "function") throw new Error("missing");
  const env = runMod.createInputEnvelope({
    taskId: "task-1",
    command: "build",
    payload: { file: "src/a.mjs" },
  });
  if (env.taskId !== "task-1") throw new Error("wrong taskId");
  if (env.command !== "build") throw new Error("wrong command");
  if (!env.timestamp) throw new Error("missing timestamp");
});

assert("createOutputEnvelope builds result envelope", () => {
  if (typeof runMod.createOutputEnvelope !== "function") throw new Error("missing");
  const env = runMod.createOutputEnvelope({
    taskId: "task-1",
    status: "success",
    result: { output: "done" },
  });
  if (env.taskId !== "task-1") throw new Error("wrong taskId");
  if (env.status !== "success") throw new Error("wrong status");
  if (!env.timestamp) throw new Error("missing timestamp");
});

assert("validateRunner checks runner contract", () => {
  if (typeof runMod.validateRunner !== "function") throw new Error("missing");
  const valid = { name: "test", type: "local", execute: async () => {} };
  const result = runMod.validateRunner(valid);
  if (!result.valid) throw new Error("should be valid");
});

assert("validateRunner rejects incomplete runner", () => {
  const invalid = { name: "bad" };
  const result = runMod.validateRunner(invalid);
  if (result.valid) throw new Error("should be invalid");
  if (!result.errors || result.errors.length === 0) throw new Error("should have errors");
});

// ── Part 2: Runner Local ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Runner Local\x1b[0m");

const localLib = join(process.cwd(), "tools/ogu/commands/lib/runner-local.mjs");
assert("runner-local.mjs exists", () => {
  if (!existsSync(localLib)) throw new Error("file missing");
});

const localMod = await import(localLib);

assert("createLocalRunner returns runner", () => {
  if (typeof localMod.createLocalRunner !== "function") throw new Error("missing");
  const runner = localMod.createLocalRunner({ workDir: tmp });
  if (typeof runner.execute !== "function") throw new Error("missing execute");
  if (runner.type !== "local") throw new Error("type should be local");
  if (typeof runner.name !== "string") throw new Error("missing name");
});

assert("execute runs a simple command", async () => {
  const runner = localMod.createLocalRunner({ workDir: tmp });
  const result = await runner.execute({
    taskId: "t1",
    command: "echo",
    args: ["hello"],
  });
  if (result.status !== "success") throw new Error(`expected success, got ${result.status}`);
  if (!result.stdout.includes("hello")) throw new Error("should contain hello");
});

assert("execute handles failure gracefully", async () => {
  const runner = localMod.createLocalRunner({ workDir: tmp });
  const result = await runner.execute({
    taskId: "t2",
    command: "node",
    args: ["-e", "process.exit(1)"],
  });
  if (result.status !== "error") throw new Error(`expected error, got ${result.status}`);
});

assert("getStatus returns runner status", () => {
  const runner = localMod.createLocalRunner({ workDir: tmp });
  const status = runner.getStatus();
  if (status.type !== "local") throw new Error("wrong type");
  if (typeof status.workDir !== "string") throw new Error("missing workDir");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
