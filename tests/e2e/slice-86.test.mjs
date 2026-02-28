/**
 * Slice 86 — Idempotency Manager + Transaction Log
 *
 * Idempotency: prevent duplicate execution with idempotency keys.
 * Transaction log: append-only log of all state transitions.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice86-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 86 — Idempotency Manager + Transaction Log\x1b[0m\n");

// ── Part 1: Idempotency Manager ──────────────────────────────

console.log("\x1b[36m  Part 1: Idempotency Manager\x1b[0m");

const idLib = join(process.cwd(), "tools/ogu/commands/lib/idempotency-manager.mjs");
assert("idempotency-manager.mjs exists", () => {
  if (!existsSync(idLib)) throw new Error("file missing");
});

const idMod = await import(idLib);

assert("createIdempotencyManager returns manager", () => {
  if (typeof idMod.createIdempotencyManager !== "function") throw new Error("missing");
  const mgr = idMod.createIdempotencyManager();
  if (typeof mgr.check !== "function") throw new Error("missing check");
  if (typeof mgr.record !== "function") throw new Error("missing record");
  if (typeof mgr.getResult !== "function") throw new Error("missing getResult");
});

assert("first check returns false (not seen)", () => {
  const mgr = idMod.createIdempotencyManager();
  if (mgr.check("key-1")) throw new Error("first check should return false");
});

assert("record then check returns true", () => {
  const mgr = idMod.createIdempotencyManager();
  mgr.record("key-1", { result: "ok" });
  if (!mgr.check("key-1")) throw new Error("should return true after record");
});

assert("getResult returns stored result", () => {
  const mgr = idMod.createIdempotencyManager();
  mgr.record("key-2", { data: 42 });
  const result = mgr.getResult("key-2");
  if (result.data !== 42) throw new Error("wrong result");
});

assert("getResult returns null for unknown key", () => {
  const mgr = idMod.createIdempotencyManager();
  const result = mgr.getResult("nope");
  if (result !== null) throw new Error("should return null");
});

assert("clear removes all keys", () => {
  const mgr = idMod.createIdempotencyManager();
  mgr.record("a", {});
  mgr.record("b", {});
  mgr.clear();
  if (mgr.check("a")) throw new Error("should be cleared");
  if (mgr.check("b")) throw new Error("should be cleared");
});

// ── Part 2: Transaction Log ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Transaction Log\x1b[0m");

const txLib = join(process.cwd(), "tools/ogu/commands/lib/transaction-log.mjs");
assert("transaction-log.mjs exists", () => {
  if (!existsSync(txLib)) throw new Error("file missing");
});

const txMod = await import(txLib);

assert("createTransactionLog returns log", () => {
  if (typeof txMod.createTransactionLog !== "function") throw new Error("missing");
  const log = txMod.createTransactionLog();
  if (typeof log.append !== "function") throw new Error("missing append");
  if (typeof log.getEntries !== "function") throw new Error("missing getEntries");
  if (typeof log.getByType !== "function") throw new Error("missing getByType");
});

assert("append adds entry with sequence number", () => {
  const log = txMod.createTransactionLog();
  log.append({ type: "state_change", from: "idle", to: "building" });
  const entries = log.getEntries();
  if (entries.length !== 1) throw new Error(`expected 1, got ${entries.length}`);
  if (typeof entries[0].seq !== "number") throw new Error("missing seq");
  if (entries[0].seq !== 1) throw new Error("first seq should be 1");
});

assert("sequence numbers increment", () => {
  const log = txMod.createTransactionLog();
  log.append({ type: "a" });
  log.append({ type: "b" });
  log.append({ type: "c" });
  const entries = log.getEntries();
  if (entries[0].seq !== 1 || entries[1].seq !== 2 || entries[2].seq !== 3) {
    throw new Error("sequence should increment");
  }
});

assert("getByType filters entries", () => {
  const log = txMod.createTransactionLog();
  log.append({ type: "gate_pass", gate: 1 });
  log.append({ type: "error", message: "fail" });
  log.append({ type: "gate_pass", gate: 2 });
  const passes = log.getByType("gate_pass");
  if (passes.length !== 2) throw new Error(`expected 2, got ${passes.length}`);
});

assert("getSince returns entries after sequence", () => {
  if (typeof txMod.createTransactionLog !== "function") throw new Error("missing");
  const log = txMod.createTransactionLog();
  log.append({ type: "a" });
  log.append({ type: "b" });
  log.append({ type: "c" });
  const since = log.getSince(2);
  if (since.length !== 1) throw new Error(`expected 1 entry after seq 2, got ${since.length}`);
  if (since[0].type !== "c") throw new Error("should be entry c");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
