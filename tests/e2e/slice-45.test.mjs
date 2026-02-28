/**
 * Slice 45 — Materialized Views + Stream Cursor (P22 + Reconnect)
 *
 * Materialized Views: derived state reducers from event stream.
 * Stream Cursor: seq-based recovery for SSE reconnection.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice45-${Date.now()}`);
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

console.log("\n\x1b[1mSlice 45 — Materialized Views + Stream Cursor\x1b[0m\n");
console.log("  Derived state, SSE reconnection\n");

// ── Part 1: Materialized Views ──────────────────────────────

console.log("\x1b[36m  Part 1: Materialized Views\x1b[0m");

const viewLib = join(process.cwd(), "tools/ogu/commands/lib/materialized-views.mjs");
assert("materialized-views.mjs exists", () => {
  if (!existsSync(viewLib)) throw new Error("file missing");
});

const viewMod = await import(viewLib);

assert("createViewStore creates empty store", () => {
  if (typeof viewMod.createViewStore !== "function") throw new Error("missing");
  const store = viewMod.createViewStore();
  if (!store) throw new Error("no store");
  if (typeof store.apply !== "function") throw new Error("no apply method");
  if (typeof store.getView !== "function") throw new Error("no getView method");
});

assert("apply reduces budget events into budgetByFeature view", () => {
  const store = viewMod.createViewStore();
  store.apply({ type: "budget.spent", payload: { feature: "auth", amount: 5.20, model: "claude-sonnet" } });
  store.apply({ type: "budget.spent", payload: { feature: "auth", amount: 3.10, model: "claude-opus" } });
  store.apply({ type: "budget.spent", payload: { feature: "payments", amount: 1.50, model: "claude-sonnet" } });

  const view = store.getView("budgetByFeature");
  if (!view) throw new Error("no budgetByFeature view");
  if (!view.auth) throw new Error("no auth feature");
  if (Math.abs(view.auth.total - 8.30) > 0.01) throw new Error(`expected 8.30, got ${view.auth.total}`);
  if (!view.payments) throw new Error("no payments feature");
});

assert("apply reduces lock events into locks view", () => {
  const store = viewMod.createViewStore();
  store.apply({ type: "lock.acquired", payload: { filePath: "src/a.ts", taskId: "t1", roleId: "dev" } });
  store.apply({ type: "lock.acquired", payload: { filePath: "src/b.ts", taskId: "t2", roleId: "test" } });

  const locks = store.getView("locks");
  if (!locks) throw new Error("no locks view");
  if (Object.keys(locks).length < 2) throw new Error("expected 2 locks");
  if (!locks["src/a.ts"]) throw new Error("missing lock for src/a.ts");
});

assert("apply handles lock release", () => {
  const store = viewMod.createViewStore();
  store.apply({ type: "lock.acquired", payload: { filePath: "src/a.ts", taskId: "t1" } });
  store.apply({ type: "lock.released", payload: { filePath: "src/a.ts" } });

  const locks = store.getView("locks");
  if (locks["src/a.ts"]) throw new Error("lock should be released");
});

assert("apply reduces governance events into queue", () => {
  const store = viewMod.createViewStore();
  store.apply({ type: "governance.pending", payload: { id: "g1", action: "deploy", requester: "dev" } });
  store.apply({ type: "governance.pending", payload: { id: "g2", action: "delete", requester: "dev" } });
  store.apply({ type: "governance.resolved", payload: { id: "g1", status: "approved" } });

  const queue = store.getView("governanceQueue");
  if (!Array.isArray(queue)) throw new Error("queue should be array");
  if (queue.length !== 1) throw new Error(`expected 1 pending, got ${queue.length}`);
  if (queue[0].id !== "g2") throw new Error("wrong pending item");
});

assert("apply reduces agent events into active VMs", () => {
  const store = viewMod.createViewStore();
  store.apply({ type: "agent.started", payload: { sessionId: "s1", roleId: "developer", taskId: "t1" } });
  store.apply({ type: "agent.started", payload: { sessionId: "s2", roleId: "tester", taskId: "t2" } });

  const vms = store.getView("activeVMs");
  if (!Array.isArray(vms)) throw new Error("vms should be array");
  if (vms.length !== 2) throw new Error(`expected 2 VMs, got ${vms.length}`);
});

assert("getSnapshot returns all views", () => {
  const store = viewMod.createViewStore();
  store.apply({ type: "budget.spent", payload: { feature: "x", amount: 1, model: "m" } });

  if (typeof store.getSnapshot !== "function") throw new Error("missing");
  const snapshot = store.getSnapshot();
  if (!snapshot.budgetByFeature) throw new Error("no budgetByFeature");
  if (!snapshot.locks) throw new Error("no locks");
  if (!snapshot.governanceQueue) throw new Error("no governanceQueue");
  if (!snapshot.activeVMs) throw new Error("no activeVMs");
});

// ── Part 2: Stream Cursor ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Stream Cursor\x1b[0m");

const cursorLib = join(process.cwd(), "tools/ogu/commands/lib/stream-cursor.mjs");
assert("stream-cursor.mjs exists", () => {
  if (!existsSync(cursorLib)) throw new Error("file missing");
});

const cursorMod = await import(cursorLib);

assert("createCursorStore creates cursor tracker", () => {
  if (typeof cursorMod.createCursorStore !== "function") throw new Error("missing");
  const store = cursorMod.createCursorStore();
  if (!store) throw new Error("no store");
  if (typeof store.setCursor !== "function") throw new Error("no setCursor");
  if (typeof store.getCursor !== "function") throw new Error("no getCursor");
});

assert("setCursor and getCursor track per-stream progress", () => {
  const store = cursorMod.createCursorStore();
  store.setCursor("budget", 42);
  store.setCursor("audit", 100);

  if (store.getCursor("budget") !== 42) throw new Error("wrong budget cursor");
  if (store.getCursor("audit") !== 100) throw new Error("wrong audit cursor");
  if (store.getCursor("unknown") !== 0) throw new Error("unknown should default to 0");
});

assert("getMissedEvents returns events after cursor", () => {
  if (typeof cursorMod.getMissedEvents !== "function") throw new Error("missing");
  const allEvents = [
    { seq: 1, streamKey: "budget", type: "a", payload: {} },
    { seq: 2, streamKey: "budget", type: "b", payload: {} },
    { seq: 3, streamKey: "audit", type: "c", payload: {} },
    { seq: 4, streamKey: "budget", type: "d", payload: {} },
    { seq: 5, streamKey: "audit", type: "e", payload: {} },
  ];
  const missed = cursorMod.getMissedEvents(allEvents, "budget", 2);
  if (missed.length !== 1) throw new Error(`expected 1 missed, got ${missed.length}`);
  if (missed[0].seq !== 4) throw new Error("wrong missed event");
});

assert("getAllCursors returns cursor map", () => {
  const store = cursorMod.createCursorStore();
  store.setCursor("a", 10);
  store.setCursor("b", 20);
  if (typeof store.getAllCursors !== "function") throw new Error("missing");
  const cursors = store.getAllCursors();
  if (cursors.a !== 10) throw new Error("wrong cursor a");
  if (cursors.b !== 20) throw new Error("wrong cursor b");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
