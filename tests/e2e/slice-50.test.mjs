/**
 * Slice 50 — Distributed Runner Schema + Health Dashboard + Session Cleanup
 *
 * Distributed Runner: remote runner registration and health tracking.
 * Health Dashboard: aggregate health status across all subsystems.
 * Session Cleanup: automatic cleanup of stale sessions.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice50-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents/sessions"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), "{}");
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");
writeFileSync(join(tmp, ".ogu/budget/budget-state.json"), JSON.stringify({
  daily: { spent: 10, limit: 100 },
  monthly: { spent: 50, limit: 2000 },
}));
writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify({
  company: "TestCo",
  roles: [{ id: "developer", name: "Dev", capabilities: ["code"] }],
  providers: [{ id: "anthropic", name: "Anthropic", models: ["claude-sonnet"] }],
  budget: { dailyLimit: 100, monthlyLimit: 2000 },
}, null, 2));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 50 — Distributed Runner + Health Dashboard + Session Cleanup\x1b[0m\n");
console.log("  Remote runners, aggregate health, session management\n");

// ── Part 1: Distributed Runner Schema ──────────────────────────────

console.log("\x1b[36m  Part 1: Distributed Runner Schema\x1b[0m");

const runnerLib = join(process.cwd(), "tools/ogu/commands/lib/distributed-runner.mjs");
assert("distributed-runner.mjs exists", () => {
  if (!existsSync(runnerLib)) throw new Error("file missing");
});

const runnerMod = await import(runnerLib);

assert("registerRunner adds a runner to the registry", () => {
  if (typeof runnerMod.registerRunner !== "function") throw new Error("missing");
  const runner = runnerMod.registerRunner({
    root: tmp,
    id: "runner-1",
    host: "localhost",
    port: 9001,
    capabilities: ["code", "test"],
    maxConcurrency: 4,
  });
  if (runner.id !== "runner-1") throw new Error("wrong id");
  if (runner.status !== "idle") throw new Error("wrong initial status");
});

assert("registerRunner supports multiple runners", () => {
  runnerMod.registerRunner({
    root: tmp,
    id: "runner-2",
    host: "192.168.1.10",
    port: 9002,
    capabilities: ["review"],
    maxConcurrency: 2,
  });
});

assert("listRunners returns all registered runners", () => {
  if (typeof runnerMod.listRunners !== "function") throw new Error("missing");
  const runners = runnerMod.listRunners({ root: tmp });
  if (runners.length < 2) throw new Error(`expected at least 2, got ${runners.length}`);
});

assert("updateRunnerStatus changes runner state", () => {
  if (typeof runnerMod.updateRunnerStatus !== "function") throw new Error("missing");
  runnerMod.updateRunnerStatus({ root: tmp, id: "runner-1", status: "busy", activeTasks: 3 });
  const runners = runnerMod.listRunners({ root: tmp });
  const r1 = runners.find(r => r.id === "runner-1");
  if (r1.status !== "busy") throw new Error("status not updated");
  if (r1.activeTasks !== 3) throw new Error("activeTasks not updated");
});

assert("removeRunner unregisters a runner", () => {
  if (typeof runnerMod.removeRunner !== "function") throw new Error("missing");
  runnerMod.removeRunner({ root: tmp, id: "runner-2" });
  const runners = runnerMod.listRunners({ root: tmp });
  if (runners.some(r => r.id === "runner-2")) throw new Error("not removed");
});

// ── Part 2: Health Dashboard ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Health Dashboard\x1b[0m");

const healthLib = join(process.cwd(), "tools/ogu/commands/lib/health-dashboard.mjs");
assert("health-dashboard.mjs exists", () => {
  if (!existsSync(healthLib)) throw new Error("file missing");
});

const healthMod = await import(healthLib);

assert("checkSystemHealth returns aggregate status", () => {
  if (typeof healthMod.checkSystemHealth !== "function") throw new Error("missing");
  const health = healthMod.checkSystemHealth({ root: tmp });
  if (!health.overall) throw new Error("no overall status");
  if (!Array.isArray(health.checks)) throw new Error("no checks array");
  if (typeof health.score !== "number") throw new Error("no score");
});

assert("health checks cover key subsystems", () => {
  const health = healthMod.checkSystemHealth({ root: tmp });
  const checkNames = health.checks.map(c => c.name);
  if (!checkNames.includes("state")) throw new Error("missing state check");
  if (!checkNames.includes("orgspec")) throw new Error("missing orgspec check");
  if (!checkNames.includes("budget")) throw new Error("missing budget check");
  if (!checkNames.includes("audit")) throw new Error("missing audit check");
});

assert("health score reflects check results", () => {
  const health = healthMod.checkSystemHealth({ root: tmp });
  if (health.score < 0 || health.score > 100) throw new Error("score out of range");
  // With valid state, orgspec, budget, audit — should be decent
  if (health.score < 50) throw new Error("score too low for valid setup");
});

// ── Part 3: Session Cleanup ──────────────────────────────

console.log("\n\x1b[36m  Part 3: Session Cleanup\x1b[0m");

const cleanupLib = join(process.cwd(), "tools/ogu/commands/lib/session-cleanup.mjs");
assert("session-cleanup.mjs exists", () => {
  if (!existsSync(cleanupLib)) throw new Error("file missing");
});

const cleanupMod = await import(cleanupLib);

// Create some stale sessions
const sessDir = join(tmp, ".ogu/agents/sessions");
const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24h ago
writeFileSync(join(sessDir, "old-1.json"), JSON.stringify({ sessionId: "old-1", status: "active", startedAt: oldDate }));
writeFileSync(join(sessDir, "old-2.json"), JSON.stringify({ sessionId: "old-2", status: "active", startedAt: oldDate }));
writeFileSync(join(sessDir, "recent.json"), JSON.stringify({ sessionId: "recent", status: "active", startedAt: new Date().toISOString() }));

assert("findStaleSessions identifies old active sessions", () => {
  if (typeof cleanupMod.findStaleSessions !== "function") throw new Error("missing");
  const stale = cleanupMod.findStaleSessions({ root: tmp, maxAgeMs: 12 * 60 * 60 * 1000 }); // 12h
  if (stale.length < 2) throw new Error(`expected at least 2 stale, got ${stale.length}`);
});

assert("cleanupStaleSessions marks them as timed_out", () => {
  if (typeof cleanupMod.cleanupStaleSessions !== "function") throw new Error("missing");
  const result = cleanupMod.cleanupStaleSessions({ root: tmp, maxAgeMs: 12 * 60 * 60 * 1000 });
  if (result.cleaned < 2) throw new Error(`expected at least 2 cleaned, got ${result.cleaned}`);
  // Check that old-1 is now timed_out
  const s = JSON.parse(readFileSync(join(sessDir, "old-1.json"), "utf8"));
  if (s.status !== "timed_out") throw new Error(`expected timed_out, got ${s.status}`);
});

assert("cleanupStaleSessions preserves recent sessions", () => {
  const s = JSON.parse(readFileSync(join(sessDir, "recent.json"), "utf8"));
  if (s.status !== "active") throw new Error("recent session should remain active");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
