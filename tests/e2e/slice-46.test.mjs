/**
 * Slice 46 — Advisory Locks + State Compaction (Topology 2) + IPC Protocol (Topology 3)
 *
 * Advisory Locks: cooperative file-level locking with timeouts.
 * State Compaction: compact large JSONL files.
 * IPC Protocol: formal command protocol for inter-process communication.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice46-${Date.now()}`);
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

console.log("\n\x1b[1mSlice 46 — Advisory Locks + State Compaction + IPC Protocol\x1b[0m\n");
console.log("  Cooperative locks, JSONL compaction, IPC commands\n");

// ── Part 1: Advisory Locks ──────────────────────────────

console.log("\x1b[36m  Part 1: Advisory Locks\x1b[0m");

const lockLib = join(process.cwd(), "tools/ogu/commands/lib/advisory-lock.mjs");
assert("advisory-lock.mjs exists", () => {
  if (!existsSync(lockLib)) throw new Error("file missing");
});

const lockMod = await import(lockLib);

assert("tryAcquire creates an advisory lock with timeout", () => {
  if (typeof lockMod.tryAcquire !== "function") throw new Error("missing");
  const lock = lockMod.tryAcquire({
    root: tmp,
    resource: "STATE.json",
    owner: "compile",
    ttlMs: 5000,
  });
  if (!lock.acquired) throw new Error("should acquire");
  if (!lock.lockId) throw new Error("no lockId");
});

assert("tryAcquire rejects when already locked", () => {
  const lock = lockMod.tryAcquire({
    root: tmp,
    resource: "STATE.json",
    owner: "other-process",
    ttlMs: 5000,
  });
  if (lock.acquired) throw new Error("should be rejected");
  if (!lock.holder) throw new Error("should report holder");
});

assert("release frees the advisory lock", () => {
  if (typeof lockMod.release !== "function") throw new Error("missing");
  lockMod.release({ root: tmp, resource: "STATE.json", owner: "compile" });
  const lock = lockMod.tryAcquire({ root: tmp, resource: "STATE.json", owner: "other", ttlMs: 5000 });
  if (!lock.acquired) throw new Error("should acquire after release");
  lockMod.release({ root: tmp, resource: "STATE.json", owner: "other" });
});

assert("isLocked checks lock status", () => {
  if (typeof lockMod.isLocked !== "function") throw new Error("missing");
  lockMod.tryAcquire({ root: tmp, resource: "test.json", owner: "p1", ttlMs: 5000 });
  if (!lockMod.isLocked({ root: tmp, resource: "test.json" })) throw new Error("should be locked");
  lockMod.release({ root: tmp, resource: "test.json", owner: "p1" });
  if (lockMod.isLocked({ root: tmp, resource: "test.json" })) throw new Error("should be free");
});

// ── Part 2: State Compaction ──────────────────────────────

console.log("\n\x1b[36m  Part 2: State Compaction\x1b[0m");

const compactLib = join(process.cwd(), "tools/ogu/commands/lib/state-compaction.mjs");
assert("state-compaction.mjs exists", () => {
  if (!existsSync(compactLib)) throw new Error("file missing");
});

const compactMod = await import(compactLib);

assert("compactJSONL removes duplicate keys keeping latest", () => {
  if (typeof compactMod.compactJSONL !== "function") throw new Error("missing");
  const input = [
    '{"id":"a","value":1}',
    '{"id":"b","value":2}',
    '{"id":"a","value":3}',
    '{"id":"c","value":4}',
    '{"id":"b","value":5}',
  ].join("\n") + "\n";
  const logPath = join(tmp, ".ogu/test-compact.jsonl");
  writeFileSync(logPath, input);
  const result = compactMod.compactJSONL({ filePath: logPath, keyField: "id" });
  if (result.before !== 5) throw new Error(`before: expected 5, got ${result.before}`);
  if (result.after !== 3) throw new Error(`after: expected 3, got ${result.after}`);
  // Verify latest values kept
  const lines = readFileSync(logPath, "utf8").trim().split("\n");
  const entries = lines.map(l => JSON.parse(l));
  const a = entries.find(e => e.id === "a");
  if (a.value !== 3) throw new Error("should keep latest value for 'a'");
});

assert("compactJSONL handles empty file", () => {
  const emptyPath = join(tmp, ".ogu/empty.jsonl");
  writeFileSync(emptyPath, "");
  const result = compactMod.compactJSONL({ filePath: emptyPath, keyField: "id" });
  if (result.before !== 0) throw new Error("should be 0");
  if (result.after !== 0) throw new Error("should be 0");
});

assert("analyzeCompaction reports savings", () => {
  if (typeof compactMod.analyzeCompaction !== "function") throw new Error("missing");
  const logPath = join(tmp, ".ogu/analyze.jsonl");
  const lines = [];
  for (let i = 0; i < 20; i++) {
    lines.push(JSON.stringify({ id: `item-${i % 5}`, v: i }));
  }
  writeFileSync(logPath, lines.join("\n") + "\n");
  const analysis = compactMod.analyzeCompaction({ filePath: logPath, keyField: "id" });
  if (analysis.totalEntries !== 20) throw new Error("wrong total");
  if (analysis.uniqueKeys !== 5) throw new Error("wrong unique keys");
  if (analysis.duplicates !== 15) throw new Error("wrong duplicates");
  if (typeof analysis.savingsPercent !== "number") throw new Error("no savings percent");
});

// ── Part 3: IPC Command Protocol ──────────────────────────────

console.log("\n\x1b[36m  Part 3: IPC Command Protocol\x1b[0m");

const ipcLib = join(process.cwd(), "tools/ogu/commands/lib/ipc-protocol.mjs");
assert("ipc-protocol.mjs exists", () => {
  if (!existsSync(ipcLib)) throw new Error("file missing");
});

const ipcMod = await import(ipcLib);

assert("createCommand builds command envelope", () => {
  if (typeof ipcMod.createCommand !== "function") throw new Error("missing");
  const cmd = ipcMod.createCommand({
    action: "task.enqueue",
    payload: { taskId: "t1", featureSlug: "auth" },
    sender: "studio",
  });
  if (!cmd.id) throw new Error("no id");
  if (cmd.action !== "task.enqueue") throw new Error("wrong action");
  if (!cmd.timestamp) throw new Error("no timestamp");
});

assert("createResponse builds response envelope", () => {
  if (typeof ipcMod.createResponse !== "function") throw new Error("missing");
  const cmd = ipcMod.createCommand({ action: "status", payload: {}, sender: "cli" });
  const res = ipcMod.createResponse({
    commandId: cmd.id,
    status: "ok",
    data: { running: true, queue: 3 },
  });
  if (res.commandId !== cmd.id) throw new Error("wrong commandId");
  if (res.status !== "ok") throw new Error("wrong status");
});

assert("createResponse handles error status", () => {
  const res = ipcMod.createResponse({
    commandId: "x",
    status: "error",
    error: { code: "BUDGET_EXCEEDED", message: "No budget" },
  });
  if (res.status !== "error") throw new Error("wrong status");
  if (!res.error) throw new Error("no error");
  if (res.error.code !== "BUDGET_EXCEEDED") throw new Error("wrong code");
});

assert("COMMAND_ACTIONS lists valid actions", () => {
  if (!ipcMod.COMMAND_ACTIONS) throw new Error("missing");
  if (!ipcMod.COMMAND_ACTIONS.includes("task.enqueue")) throw new Error("missing task.enqueue");
  if (!ipcMod.COMMAND_ACTIONS.includes("status")) throw new Error("missing status");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
