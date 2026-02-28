/**
 * Slice 156 — Connection Pool + Connection Lifecycle
 *
 * Connection Pool: reusable connection pool with acquire/release.
 * Connection Lifecycle: track connection state transitions.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 156 — Connection Pool + Connection Lifecycle\x1b[0m\n");

// ── Part 1: Connection Pool ──────────────────────────────

console.log("\x1b[36m  Part 1: Connection Pool\x1b[0m");

const cpLib = join(process.cwd(), "tools/ogu/commands/lib/connection-pool.mjs");
assert("connection-pool.mjs exists", () => {
  if (!existsSync(cpLib)) throw new Error("file missing");
});

const cpMod = await import(cpLib);

assert("createConnectionPool returns pool", () => {
  if (typeof cpMod.createConnectionPool !== "function") throw new Error("missing");
  const pool = cpMod.createConnectionPool({ maxSize: 5 });
  if (typeof pool.acquire !== "function") throw new Error("missing acquire");
  if (typeof pool.release !== "function") throw new Error("missing release");
  if (typeof pool.getStats !== "function") throw new Error("missing getStats");
});

assert("acquire returns a connection", () => {
  const pool = cpMod.createConnectionPool({ maxSize: 3 });
  const conn = pool.acquire();
  if (!conn || !conn.id) throw new Error("should return connection with id");
});

assert("release returns connection to pool", () => {
  const pool = cpMod.createConnectionPool({ maxSize: 3 });
  const conn = pool.acquire();
  pool.release(conn.id);
  const stats = pool.getStats();
  if (stats.idle !== 1) throw new Error(`expected 1 idle, got ${stats.idle}`);
});

assert("pool respects maxSize", () => {
  const pool = cpMod.createConnectionPool({ maxSize: 2 });
  pool.acquire();
  pool.acquire();
  const conn3 = pool.acquire();
  if (conn3 !== null) throw new Error("should return null when exhausted");
});

assert("released connections are reused", () => {
  const pool = cpMod.createConnectionPool({ maxSize: 1 });
  const conn1 = pool.acquire();
  pool.release(conn1.id);
  const conn2 = pool.acquire();
  if (conn2.id !== conn1.id) throw new Error("should reuse released connection");
});

assert("getStats tracks active and idle", () => {
  const pool = cpMod.createConnectionPool({ maxSize: 5 });
  pool.acquire();
  pool.acquire();
  const stats = pool.getStats();
  if (stats.active !== 2) throw new Error(`expected 2 active, got ${stats.active}`);
  if (stats.total !== 2) throw new Error(`expected 2 total, got ${stats.total}`);
});

// ── Part 2: Connection Lifecycle ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Connection Lifecycle\x1b[0m");

const clLib = join(process.cwd(), "tools/ogu/commands/lib/connection-lifecycle.mjs");
assert("connection-lifecycle.mjs exists", () => {
  if (!existsSync(clLib)) throw new Error("file missing");
});

const clMod = await import(clLib);

assert("createConnectionLifecycle returns tracker", () => {
  if (typeof clMod.createConnectionLifecycle !== "function") throw new Error("missing");
  const lc = clMod.createConnectionLifecycle();
  if (typeof lc.create !== "function") throw new Error("missing create");
  if (typeof lc.transition !== "function") throw new Error("missing transition");
  if (typeof lc.getState !== "function") throw new Error("missing getState");
});

assert("create starts in 'created' state", () => {
  const lc = clMod.createConnectionLifecycle();
  const id = lc.create("conn-1");
  const state = lc.getState(id);
  if (state !== "created") throw new Error(`expected created, got ${state}`);
});

assert("transition changes state", () => {
  const lc = clMod.createConnectionLifecycle();
  const id = lc.create("conn-1");
  lc.transition(id, "active");
  if (lc.getState(id) !== "active") throw new Error("should be active");
});

assert("invalid transition throws", () => {
  const lc = clMod.createConnectionLifecycle();
  const id = lc.create("conn-1");
  lc.transition(id, "active");
  let threw = false;
  try { lc.transition(id, "created"); } catch { threw = true; }
  if (!threw) throw new Error("should reject invalid transition");
});

assert("getHistory returns transitions", () => {
  const lc = clMod.createConnectionLifecycle();
  const id = lc.create("conn-1");
  lc.transition(id, "active");
  lc.transition(id, "idle");
  const history = lc.getHistory(id);
  if (history.length < 3) throw new Error(`expected >=3, got ${history.length}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
