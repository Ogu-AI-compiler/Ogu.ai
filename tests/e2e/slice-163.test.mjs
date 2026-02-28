/**
 * Slice 163 — Connection Manager + Handshake Manager
 *
 * Connection Manager: manage connection lifecycle with monitoring.
 * Handshake Manager: negotiate and validate connection parameters.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 163 — Connection Manager + Handshake Manager\x1b[0m\n");

// ── Part 1: Connection Manager ──────────────────────────────

console.log("\x1b[36m  Part 1: Connection Manager\x1b[0m");

const cmLib = join(process.cwd(), "tools/ogu/commands/lib/connection-manager.mjs");
assert("connection-manager.mjs exists", () => {
  if (!existsSync(cmLib)) throw new Error("file missing");
});

const cmMod = await import(cmLib);

assert("createConnectionManager returns manager", () => {
  if (typeof cmMod.createConnectionManager !== "function") throw new Error("missing");
  const mgr = cmMod.createConnectionManager();
  if (typeof mgr.open !== "function") throw new Error("missing open");
  if (typeof mgr.close !== "function") throw new Error("missing close");
  if (typeof mgr.getConnection !== "function") throw new Error("missing getConnection");
});

assert("open creates connection", () => {
  const mgr = cmMod.createConnectionManager();
  const conn = mgr.open({ host: "localhost", port: 5432 });
  if (!conn.id) throw new Error("missing id");
  if (conn.status !== "open") throw new Error(`expected open, got ${conn.status}`);
});

assert("close marks connection closed", () => {
  const mgr = cmMod.createConnectionManager();
  const conn = mgr.open({ host: "localhost" });
  mgr.close(conn.id);
  const updated = mgr.getConnection(conn.id);
  if (updated.status !== "closed") throw new Error(`expected closed, got ${updated.status}`);
});

assert("listConnections returns all", () => {
  const mgr = cmMod.createConnectionManager();
  mgr.open({ host: "a.com" });
  mgr.open({ host: "b.com" });
  const list = mgr.listConnections();
  if (list.length !== 2) throw new Error(`expected 2, got ${list.length}`);
});

assert("getStats returns counts", () => {
  const mgr = cmMod.createConnectionManager();
  mgr.open({ host: "a.com" });
  const conn = mgr.open({ host: "b.com" });
  mgr.close(conn.id);
  const stats = mgr.getStats();
  if (stats.open !== 1) throw new Error(`expected 1 open, got ${stats.open}`);
  if (stats.closed !== 1) throw new Error(`expected 1 closed, got ${stats.closed}`);
});

// ── Part 2: Handshake Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Handshake Manager\x1b[0m");

const hmLib = join(process.cwd(), "tools/ogu/commands/lib/handshake-manager.mjs");
assert("handshake-manager.mjs exists", () => {
  if (!existsSync(hmLib)) throw new Error("file missing");
});

const hmMod = await import(hmLib);

assert("createHandshakeManager returns manager", () => {
  if (typeof hmMod.createHandshakeManager !== "function") throw new Error("missing");
  const hm = hmMod.createHandshakeManager();
  if (typeof hm.initiate !== "function") throw new Error("missing initiate");
  if (typeof hm.accept !== "function") throw new Error("missing accept");
  if (typeof hm.getStatus !== "function") throw new Error("missing getStatus");
});

assert("initiate starts handshake", () => {
  const hm = hmMod.createHandshakeManager();
  const hs = hm.initiate({ clientId: "c1", protocol: "v2" });
  if (!hs.id) throw new Error("missing id");
  if (hs.status !== "pending") throw new Error(`expected pending, got ${hs.status}`);
});

assert("accept completes handshake", () => {
  const hm = hmMod.createHandshakeManager();
  const hs = hm.initiate({ clientId: "c1", protocol: "v2" });
  hm.accept(hs.id, { serverProtocol: "v2" });
  const status = hm.getStatus(hs.id);
  if (status.status !== "completed") throw new Error(`expected completed, got ${status.status}`);
});

assert("reject fails handshake", () => {
  const hm = hmMod.createHandshakeManager();
  const hs = hm.initiate({ clientId: "c1", protocol: "v1" });
  hm.reject(hs.id, "unsupported protocol");
  const status = hm.getStatus(hs.id);
  if (status.status !== "rejected") throw new Error(`expected rejected, got ${status.status}`);
});

assert("getStats tracks handshake counts", () => {
  const hm = hmMod.createHandshakeManager();
  const h1 = hm.initiate({ clientId: "c1" });
  const h2 = hm.initiate({ clientId: "c2" });
  hm.accept(h1.id, {});
  hm.reject(h2.id, "no");
  const stats = hm.getStats();
  if (stats.completed !== 1) throw new Error(`expected 1 completed, got ${stats.completed}`);
  if (stats.rejected !== 1) throw new Error(`expected 1 rejected, got ${stats.rejected}`);
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
