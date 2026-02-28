/**
 * Slice 48 — Global Search Engine + Backpressure Manager
 *
 * Global Search: cross-entity search (features, tasks, audit, memory).
 * Backpressure: event coalescing with 100ms window and critical bypass.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice48-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/memory"), { recursive: true });
mkdirSync(join(tmp, "docs/vault/04_Features/auth"), { recursive: true });
mkdirSync(join(tmp, "docs/vault/04_Features/payments"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), [
  JSON.stringify({ id: "e1", type: "task.started", timestamp: "2026-02-28T10:00:00Z", payload: { task: "auth-login", roleId: "developer" } }),
  JSON.stringify({ id: "e2", type: "task.completed", timestamp: "2026-02-28T11:00:00Z", payload: { task: "auth-login", roleId: "developer" } }),
  JSON.stringify({ id: "e3", type: "gate.passed", timestamp: "2026-02-28T12:00:00Z", payload: { gate: "03-spec", feature: "auth" } }),
].join("\n") + "\n");
writeFileSync(join(tmp, "docs/vault/04_Features/auth/PRD.md"), "# Auth\n\n## Login\n\nUser authentication with email and password.\n");
writeFileSync(join(tmp, "docs/vault/04_Features/auth/Plan.json"), JSON.stringify({ tasks: [{ id: 1, title: "Login form", outputs: ["COMPONENT:LoginForm"] }] }));
writeFileSync(join(tmp, "docs/vault/04_Features/payments/PRD.md"), "# Payments\n\n## Checkout\n\nStripe integration for checkout.\n");

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 48 — Global Search Engine + Backpressure Manager\x1b[0m\n");
console.log("  Cross-entity search, event coalescing\n");

// ── Part 1: Global Search ──────────────────────────────

console.log("\x1b[36m  Part 1: Global Search Engine\x1b[0m");

const searchLib = join(process.cwd(), "tools/ogu/commands/lib/global-search.mjs");
assert("global-search.mjs exists", () => {
  if (!existsSync(searchLib)) throw new Error("file missing");
});

const searchMod = await import(searchLib);

assert("search finds features by name", () => {
  if (typeof searchMod.search !== "function") throw new Error("missing");
  const results = searchMod.search({ root: tmp, query: "auth" });
  if (results.length < 1) throw new Error("no results");
  const featureResult = results.find(r => r.type === "feature");
  if (!featureResult) throw new Error("no feature result");
});

assert("search finds features by content", () => {
  const results = searchMod.search({ root: tmp, query: "password" });
  if (results.length < 1) throw new Error("no results for 'password'");
});

assert("search finds audit events", () => {
  const results = searchMod.search({ root: tmp, query: "auth-login" });
  const auditResults = results.filter(r => r.type === "audit");
  if (auditResults.length < 1) throw new Error("no audit results");
});

assert("search supports entity type filter", () => {
  const results = searchMod.search({ root: tmp, query: "auth", types: ["feature"] });
  const nonFeature = results.find(r => r.type !== "feature");
  if (nonFeature) throw new Error("should only return features");
});

assert("search returns scored results", () => {
  const results = searchMod.search({ root: tmp, query: "auth" });
  if (results.length < 1) throw new Error("no results");
  if (typeof results[0].score !== "number") throw new Error("no score");
});

assert("search with limit caps results", () => {
  const results = searchMod.search({ root: tmp, query: "a", limit: 2 });
  if (results.length > 2) throw new Error("should respect limit");
});

// ── Part 2: Backpressure Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Backpressure Manager\x1b[0m");

const bpLib = join(process.cwd(), "tools/ogu/commands/lib/backpressure.mjs");
assert("backpressure.mjs exists", () => {
  if (!existsSync(bpLib)) throw new Error("file missing");
});

const bpMod = await import(bpLib);

assert("createBackpressureManager creates manager", () => {
  if (typeof bpMod.createBackpressureManager !== "function") throw new Error("missing");
  const mgr = bpMod.createBackpressureManager({ windowMs: 100 });
  if (!mgr) throw new Error("no manager");
  if (typeof mgr.enqueue !== "function") throw new Error("no enqueue");
  if (typeof mgr.flush !== "function") throw new Error("no flush");
});

assert("enqueue adds events to buffer", () => {
  const mgr = bpMod.createBackpressureManager({ windowMs: 100 });
  mgr.enqueue({ type: "budget.updated", streamKey: "budget", payload: { v: 1 }, priority: "normal" });
  mgr.enqueue({ type: "budget.updated", streamKey: "budget", payload: { v: 2 }, priority: "normal" });
  mgr.enqueue({ type: "task.completed", streamKey: "tasks", payload: { id: "t1" }, priority: "normal" });
  if (mgr.bufferSize() !== 3) throw new Error(`expected 3, got ${mgr.bufferSize()}`);
});

assert("flush coalesces events", () => {
  const mgr = bpMod.createBackpressureManager({ windowMs: 100 });
  mgr.enqueue({ type: "budget.updated", streamKey: "budget", payload: { v: 1 }, priority: "normal" });
  mgr.enqueue({ type: "budget.updated", streamKey: "budget", payload: { v: 2 }, priority: "normal" });
  mgr.enqueue({ type: "budget.updated", streamKey: "budget", payload: { v: 3 }, priority: "normal" });
  mgr.enqueue({ type: "task.completed", streamKey: "tasks", payload: { id: "t1" }, priority: "normal" });

  const flushed = mgr.flush();
  // 3 budget events → 1 coalesced, 1 task event → 1 = total 2
  if (flushed.length !== 2) throw new Error(`expected 2 after coalesce, got ${flushed.length}`);
});

assert("critical events bypass coalescing", () => {
  const mgr = bpMod.createBackpressureManager({ windowMs: 100 });
  mgr.enqueue({ type: "freeze", streamKey: "system", payload: {}, priority: "critical" });
  mgr.enqueue({ type: "freeze", streamKey: "system", payload: {}, priority: "critical" });

  const flushed = mgr.flush();
  // Critical events are never coalesced
  if (flushed.length !== 2) throw new Error(`expected 2 critical events, got ${flushed.length}`);
});

assert("flush clears buffer", () => {
  const mgr = bpMod.createBackpressureManager({ windowMs: 100 });
  mgr.enqueue({ type: "a", streamKey: "x", payload: {}, priority: "normal" });
  mgr.flush();
  if (mgr.bufferSize() !== 0) throw new Error("buffer should be empty after flush");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
