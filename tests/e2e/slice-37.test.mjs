/**
 * Slice 37 — Audit Index + Daily Rotation + Replay Chain (P2 ext)
 *
 * Audit Index: quick lookup by feature, agent, daily.
 * Daily Rotation: YYYY-MM-DD.jsonl files.
 * Replay Chain: reconstruct state from event sequence.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice37-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");

// Create audit events spanning multiple days
const today = new Date().toISOString().slice(0, 10);
const events = [];
for (let i = 0; i < 20; i++) {
  events.push({
    id: `evt-${i}`,
    type: i % 3 === 0 ? "task.completed" : i % 3 === 1 ? "task.failed" : "gate.passed",
    timestamp: new Date(Date.now() - i * 3600 * 1000).toISOString(),
    severity: i % 3 === 1 ? "warn" : "info",
    payload: { feature: i % 2 === 0 ? "feat-a" : "feat-b", roleId: i % 2 === 0 ? "developer" : "architect" },
  });
}
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), events.map(e => JSON.stringify(e)).join("\n") + "\n");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 37 — Audit Index + Daily Rotation + Replay Chain\x1b[0m\n");
console.log("  Quick lookup, date-based rotation, event replay\n");

// ── Part 1: Audit Index ──────────────────────────────

console.log("\x1b[36m  Part 1: Audit Index\x1b[0m");

const indexLib = join(process.cwd(), "tools/ogu/commands/lib/audit-index.mjs");
assert("audit-index.mjs exists", () => {
  if (!existsSync(indexLib)) throw new Error("file missing");
});

const idxMod = await import(indexLib);

assert("buildIndex creates index from audit events", () => {
  if (typeof idxMod.buildIndex !== "function") throw new Error("missing");
  const index = idxMod.buildIndex({ root: tmp });
  if (!index.byFeature) throw new Error("no byFeature");
  if (!index.byType) throw new Error("no byType");
  if (!index.byDate) throw new Error("no byDate");
  if (typeof index.totalEvents !== "number") throw new Error("no totalEvents");
});

assert("index byFeature groups events correctly", () => {
  const index = idxMod.buildIndex({ root: tmp });
  if (!index.byFeature["feat-a"]) throw new Error("no feat-a");
  if (!index.byFeature["feat-b"]) throw new Error("no feat-b");
  if (index.byFeature["feat-a"].length < 5) throw new Error("too few feat-a events");
});

assert("index byType groups events correctly", () => {
  const index = idxMod.buildIndex({ root: tmp });
  if (!index.byType["task.completed"]) throw new Error("no task.completed");
  if (!index.byType["task.failed"]) throw new Error("no task.failed");
});

assert("lookupByFeature returns events for a feature", () => {
  if (typeof idxMod.lookupByFeature !== "function") throw new Error("missing");
  const events = idxMod.lookupByFeature({ root: tmp, feature: "feat-a" });
  if (!Array.isArray(events)) throw new Error("not array");
  if (events.length < 5) throw new Error("too few events");
});

assert("saveIndex persists index to disk", () => {
  if (typeof idxMod.saveIndex !== "function") throw new Error("missing");
  const index = idxMod.buildIndex({ root: tmp });
  idxMod.saveIndex({ root: tmp, index });
  if (!existsSync(join(tmp, ".ogu/audit/index.json"))) throw new Error("index not saved");
});

// ── Part 2: Daily Rotation ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Daily Rotation\x1b[0m");

const rotLib = join(process.cwd(), "tools/ogu/commands/lib/audit-rotation.mjs");
assert("audit-rotation.mjs exists", () => {
  if (!existsSync(rotLib)) throw new Error("file missing");
});

const rotMod = await import(rotLib);

assert("rotateAuditLog moves events to dated files", () => {
  if (typeof rotMod.rotateAuditLog !== "function") throw new Error("missing");
  const result = rotMod.rotateAuditLog({ root: tmp });
  if (typeof result.rotatedCount !== "number") throw new Error("no rotatedCount");
  if (typeof result.datesCreated !== "number") throw new Error("no datesCreated");
});

assert("after rotation, dated files exist", () => {
  const dateFile = join(tmp, `.ogu/audit/${today}.jsonl`);
  if (!existsSync(dateFile)) throw new Error(`no dated file for ${today}`);
});

// ── Part 3: Replay Chain ──────────────────────────────

console.log("\n\x1b[36m  Part 3: Replay Chain\x1b[0m");

const replayLib = join(process.cwd(), "tools/ogu/commands/lib/audit-replay.mjs");
assert("audit-replay.mjs exists", () => {
  if (!existsSync(replayLib)) throw new Error("file missing");
});

const replayMod = await import(replayLib);

assert("replayChain reconstructs state from events", () => {
  if (typeof replayMod.replayChain !== "function") throw new Error("missing");
  const replayEvents = [
    { type: "task.completed", payload: { taskId: "t1", feature: "f" } },
    { type: "task.completed", payload: { taskId: "t2", feature: "f" } },
    { type: "task.failed", payload: { taskId: "t3", feature: "f" } },
    { type: "gate.passed", payload: { gate: 1, feature: "f" } },
  ];
  const state = replayMod.replayChain(replayEvents);
  if (state.tasksCompleted !== 2) throw new Error(`expected 2 completed, got ${state.tasksCompleted}`);
  if (state.tasksFailed !== 1) throw new Error(`expected 1 failed, got ${state.tasksFailed}`);
  if (state.gatesPassed !== 1) throw new Error(`expected 1 gate, got ${state.gatesPassed}`);
});

assert("replayChain handles empty events", () => {
  const state = replayMod.replayChain([]);
  if (state.tasksCompleted !== 0) throw new Error("should be 0");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
