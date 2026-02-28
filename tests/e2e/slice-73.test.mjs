/**
 * Slice 73 — Rollback Engine + Consistency Model (SAGA)
 *
 * Rollback engine: compensating rollback with audit trail.
 * Consistency model: SAGA transaction boundaries with prepare-execute-commit.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 73 — Rollback Engine + Consistency Model\x1b[0m\n");

// ── Part 1: Rollback Engine ──────────────────────────────

console.log("\x1b[36m  Part 1: Rollback Engine\x1b[0m");

const rbLib = join(process.cwd(), "tools/ogu/commands/lib/rollback-engine.mjs");
assert("rollback-engine.mjs exists", () => {
  if (!existsSync(rbLib)) throw new Error("file missing");
});

const rbMod = await import(rbLib);

assert("createRollbackEngine returns engine", () => {
  if (typeof rbMod.createRollbackEngine !== "function") throw new Error("missing");
  const engine = rbMod.createRollbackEngine();
  if (typeof engine.record !== "function") throw new Error("missing record");
  if (typeof engine.rollback !== "function") throw new Error("missing rollback");
  if (typeof engine.getHistory !== "function") throw new Error("missing getHistory");
});

assert("record stores compensating action", () => {
  const engine = rbMod.createRollbackEngine();
  engine.record("create-file", { path: "src/a.mjs" }, () => ({ undone: true }));
  const h = engine.getHistory();
  if (h.length !== 1) throw new Error(`expected 1, got ${h.length}`);
  if (h[0].action !== "create-file") throw new Error("wrong action name");
});

assert("rollback executes compensations in reverse", () => {
  const order = [];
  const engine = rbMod.createRollbackEngine();
  engine.record("step1", {}, () => order.push("undo1"));
  engine.record("step2", {}, () => order.push("undo2"));
  engine.record("step3", {}, () => order.push("undo3"));
  engine.rollback();
  if (order.join(",") !== "undo3,undo2,undo1") throw new Error(`wrong order: ${order.join(",")}`);
});

assert("rollback is idempotent (marks as done)", () => {
  let count = 0;
  const engine = rbMod.createRollbackEngine();
  engine.record("step", {}, () => count++);
  engine.rollback();
  engine.rollback();
  if (count !== 1) throw new Error(`expected 1, got ${count}`);
});

assert("partial rollback to specific checkpoint", () => {
  const order = [];
  const engine = rbMod.createRollbackEngine();
  engine.record("a", {}, () => order.push("a"));
  engine.checkpoint("mid");
  engine.record("b", {}, () => order.push("b"));
  engine.record("c", {}, () => order.push("c"));
  engine.rollbackTo("mid");
  if (order.join(",") !== "c,b") throw new Error(`expected c,b got ${order.join(",")}`);
});

// ── Part 2: Consistency Model ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Consistency Model (SAGA)\x1b[0m");

const sagaLib = join(process.cwd(), "tools/ogu/commands/lib/consistency-model.mjs");
assert("consistency-model.mjs exists", () => {
  if (!existsSync(sagaLib)) throw new Error("file missing");
});

const sagaMod = await import(sagaLib);

assert("createSaga returns saga with step/execute", () => {
  if (typeof sagaMod.createSaga !== "function") throw new Error("missing");
  const saga = sagaMod.createSaga("test-saga");
  if (typeof saga.step !== "function") throw new Error("missing step");
  if (typeof saga.execute !== "function") throw new Error("missing execute");
});

assert("saga executes steps in order", async () => {
  const order = [];
  const saga = sagaMod.createSaga("ordered");
  saga.step("s1", () => order.push("do1"), () => order.push("undo1"));
  saga.step("s2", () => order.push("do2"), () => order.push("undo2"));
  await saga.execute();
  if (order.join(",") !== "do1,do2") throw new Error(`wrong order: ${order.join(",")}`);
});

assert("saga compensates on failure (reverse order)", async () => {
  const order = [];
  const saga = sagaMod.createSaga("fail-test");
  saga.step("s1", () => order.push("do1"), () => order.push("undo1"));
  saga.step("s2", () => order.push("do2"), () => order.push("undo2"));
  saga.step("s3", () => { throw new Error("boom"); }, () => order.push("undo3"));
  try { await saga.execute(); } catch (_) {}
  // s3 failed so only s1 and s2 compensate (not s3 since it never completed)
  if (!order.includes("undo2")) throw new Error("should compensate s2");
  if (!order.includes("undo1")) throw new Error("should compensate s1");
});

assert("saga reports status after execution", async () => {
  const saga = sagaMod.createSaga("status-test");
  saga.step("s1", () => {}, () => {});
  await saga.execute();
  const status = saga.getStatus();
  if (status.name !== "status-test") throw new Error("wrong name");
  if (status.state !== "completed") throw new Error(`expected completed, got ${status.state}`);
});

assert("failed saga reports compensated state", async () => {
  const saga = sagaMod.createSaga("fail-status");
  saga.step("s1", () => {}, () => {});
  saga.step("s2", () => { throw new Error("fail"); }, () => {});
  try { await saga.execute(); } catch (_) {}
  const status = saga.getStatus();
  if (status.state !== "compensated") throw new Error(`expected compensated, got ${status.state}`);
});

assert("SAGA_STATES exported", () => {
  if (!sagaMod.SAGA_STATES) throw new Error("missing");
  if (!Array.isArray(sagaMod.SAGA_STATES)) throw new Error("should be array");
  if (!sagaMod.SAGA_STATES.includes("completed")) throw new Error("missing completed");
  if (!sagaMod.SAGA_STATES.includes("compensated")) throw new Error("missing compensated");
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
