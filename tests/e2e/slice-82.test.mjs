/**
 * Slice 82 — Deployment Manager + Determinism Ledger
 *
 * Deployment manager: build artifacts and orchestrate rollout.
 * Determinism ledger: log non-deterministic events with variance tracking.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice82-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 82 — Deployment Manager + Determinism Ledger\x1b[0m\n");

// ── Part 1: Deployment Manager ──────────────────────────────

console.log("\x1b[36m  Part 1: Deployment Manager\x1b[0m");

const depLib = join(process.cwd(), "tools/ogu/commands/lib/deployment-manager.mjs");
assert("deployment-manager.mjs exists", () => {
  if (!existsSync(depLib)) throw new Error("file missing");
});

const depMod = await import(depLib);

assert("createDeploymentManager returns manager", () => {
  if (typeof depMod.createDeploymentManager !== "function") throw new Error("missing");
  const mgr = depMod.createDeploymentManager();
  if (typeof mgr.createDeployment !== "function") throw new Error("missing createDeployment");
  if (typeof mgr.getDeployment !== "function") throw new Error("missing getDeployment");
  if (typeof mgr.rollback !== "function") throw new Error("missing rollback");
});

assert("createDeployment records deployment", () => {
  const mgr = depMod.createDeploymentManager();
  const id = mgr.createDeployment({
    version: "1.0.0",
    artifacts: ["app.js", "styles.css"],
    environment: "production",
  });
  if (typeof id !== "string") throw new Error("should return id");
  const dep = mgr.getDeployment(id);
  if (dep.version !== "1.0.0") throw new Error("wrong version");
  if (dep.status !== "pending") throw new Error("should start as pending");
});

assert("promote changes status", () => {
  const mgr = depMod.createDeploymentManager();
  const id = mgr.createDeployment({ version: "1.0.0", artifacts: [], environment: "staging" });
  mgr.promote(id);
  const dep = mgr.getDeployment(id);
  if (dep.status !== "deployed") throw new Error(`expected deployed, got ${dep.status}`);
});

assert("rollback marks deployment as rolled back", () => {
  const mgr = depMod.createDeploymentManager();
  const id = mgr.createDeployment({ version: "1.0.0", artifacts: [], environment: "production" });
  mgr.promote(id);
  mgr.rollback(id);
  const dep = mgr.getDeployment(id);
  if (dep.status !== "rolled_back") throw new Error(`expected rolled_back, got ${dep.status}`);
});

assert("listDeployments returns history", () => {
  const mgr = depMod.createDeploymentManager();
  mgr.createDeployment({ version: "1.0.0", artifacts: [], environment: "prod" });
  mgr.createDeployment({ version: "1.1.0", artifacts: [], environment: "prod" });
  const list = mgr.listDeployments();
  if (list.length !== 2) throw new Error(`expected 2, got ${list.length}`);
});

assert("DEPLOY_STATUSES exported", () => {
  if (!depMod.DEPLOY_STATUSES) throw new Error("missing");
  if (!Array.isArray(depMod.DEPLOY_STATUSES)) throw new Error("should be array");
  if (!depMod.DEPLOY_STATUSES.includes("deployed")) throw new Error("missing deployed");
});

// ── Part 2: Determinism Ledger ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Determinism Ledger\x1b[0m");

const detLib = join(process.cwd(), "tools/ogu/commands/lib/determinism-ledger.mjs");
assert("determinism-ledger.mjs exists", () => {
  if (!existsSync(detLib)) throw new Error("file missing");
});

const detMod = await import(detLib);

assert("createDeterminismLedger returns ledger", () => {
  if (typeof detMod.createDeterminismLedger !== "function") throw new Error("missing");
  const ledger = detMod.createDeterminismLedger();
  if (typeof ledger.logEvent !== "function") throw new Error("missing logEvent");
  if (typeof ledger.getScore !== "function") throw new Error("missing getScore");
  if (typeof ledger.getReport !== "function") throw new Error("missing getReport");
});

assert("logEvent records non-deterministic event", () => {
  const ledger = detMod.createDeterminismLedger();
  ledger.logEvent({ source: "llm", reason: "temperature > 0", variance: 0.3 });
  const events = ledger.getEvents();
  if (events.length !== 1) throw new Error(`expected 1, got ${events.length}`);
});

assert("getScore returns determinism score 0-100", () => {
  const ledger = detMod.createDeterminismLedger();
  // No events = perfect determinism
  if (ledger.getScore() !== 100) throw new Error("empty ledger should be 100");
  ledger.logEvent({ source: "rng", reason: "random seed", variance: 0.5 });
  const score = ledger.getScore();
  if (score < 0 || score > 100) throw new Error(`score out of range: ${score}`);
  if (score >= 100) throw new Error("should be less than 100 with events");
});

assert("getReport summarizes variance by source", () => {
  const ledger = detMod.createDeterminismLedger();
  ledger.logEvent({ source: "llm", reason: "temp", variance: 0.2 });
  ledger.logEvent({ source: "llm", reason: "temp", variance: 0.3 });
  ledger.logEvent({ source: "timer", reason: "timeout", variance: 0.1 });
  const report = ledger.getReport();
  if (typeof report.totalEvents !== "number") throw new Error("missing totalEvents");
  if (!report.bySource) throw new Error("missing bySource");
  if (!report.bySource.llm) throw new Error("missing llm source");
  if (report.bySource.llm.count !== 2) throw new Error("wrong llm count");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
