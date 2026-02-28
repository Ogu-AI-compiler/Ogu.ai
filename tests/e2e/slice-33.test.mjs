/**
 * Slice 33 — Performance Index + Kadima Standup (Fix 7 + Kadima extension)
 *
 * Performance Index: per-agent metrics, success rates, learning loop.
 * Kadima Standup: generate daily standup from audit trail.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice33-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/state/features"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents"), { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({ currentFeature: "perf-test", phase: "build" }));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context");

// Agent state with some history
writeFileSync(join(tmp, ".ogu/agents/developer.state.json"), JSON.stringify({
  roleId: "developer",
  tasksCompleted: 15,
  tasksFailed: 3,
  tokensUsed: 120000,
  costUsed: 12.50,
  lastActiveAt: new Date().toISOString(),
}));
writeFileSync(join(tmp, ".ogu/agents/architect.state.json"), JSON.stringify({
  roleId: "architect",
  tasksCompleted: 8,
  tasksFailed: 1,
  tokensUsed: 80000,
  costUsed: 25.00,
  lastActiveAt: new Date().toISOString(),
}));

// Audit trail for standup
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const auditEvents = [
  { id: "e1", type: "task.completed", timestamp: yesterday.toISOString(), severity: "info", payload: { taskId: "t1", feature: "perf-test", roleId: "developer" } },
  { id: "e2", type: "task.completed", timestamp: yesterday.toISOString(), severity: "info", payload: { taskId: "t2", feature: "perf-test", roleId: "architect" } },
  { id: "e3", type: "task.failed", timestamp: yesterday.toISOString(), severity: "warn", payload: { taskId: "t3", feature: "perf-test", roleId: "developer", error: "timeout" } },
  { id: "e4", type: "gate.passed", timestamp: now.toISOString(), severity: "info", payload: { gate: 3, feature: "perf-test" } },
  { id: "e5", type: "feature.transitioned", timestamp: now.toISOString(), severity: "info", payload: { feature: "perf-test", from: "build", to: "verify" } },
];
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), auditEvents.map(e => JSON.stringify(e)).join("\n") + "\n");

const orgSpec = {
  version: "1.0.0",
  org: { name: "PerfCo" },
  roles: [
    { id: "developer", name: "Developer", department: "engineering", enabled: true, capabilities: ["code"], riskTier: "standard", maxTokensPerTask: 8000, sandbox: { allowNetwork: false, allowShell: false } },
    { id: "architect", name: "Architect", department: "architecture", enabled: true, capabilities: ["design"], riskTier: "elevated", maxTokensPerTask: 16000, sandbox: { allowNetwork: false, allowShell: false } },
  ],
  providers: [{ id: "anthropic", type: "anthropic", models: ["claude-sonnet-4-20250514"] }],
  budget: { dailyLimit: 50, monthlyLimit: 500 },
  governance: { requireApproval: [] },
};
writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify(orgSpec, null, 2));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

const CLI = join(process.cwd(), "tools/ogu/cli.mjs");
const ogu = (cmd, args = []) =>
  execFileSync("node", [CLI, cmd, ...args], {
    cwd: tmp, encoding: "utf8", timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, HOME: tmp },
  });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 33 — Performance Index + Kadima Standup (Fix 7 + Kadima ext)\x1b[0m\n");
console.log("  Per-agent metrics, daily standup generation\n");

// ── Part 1: Performance Index ──────────────────────────────

console.log("\x1b[36m  Part 1: Performance Index Library\x1b[0m");

const perfLib = join(process.cwd(), "tools/ogu/commands/lib/performance-index.mjs");
assert("performance-index.mjs exists", () => {
  if (!existsSync(perfLib)) throw new Error("file missing");
});

const perfMod = await import(perfLib);

assert("computeAgentMetrics returns metrics for all agents", () => {
  if (typeof perfMod.computeAgentMetrics !== "function") throw new Error("missing");
  const metrics = perfMod.computeAgentMetrics({ root: tmp });
  if (!Array.isArray(metrics)) throw new Error("not array");
  if (metrics.length < 2) throw new Error(`expected 2 agents, got ${metrics.length}`);
});

assert("agent metrics include success rate", () => {
  const metrics = perfMod.computeAgentMetrics({ root: tmp });
  const dev = metrics.find(m => m.roleId === "developer");
  if (!dev) throw new Error("no developer metrics");
  if (typeof dev.successRate !== "number") throw new Error("no successRate");
  // 15 completed, 3 failed → ~83%
  if (dev.successRate < 0.8 || dev.successRate > 0.9) throw new Error(`unexpected rate: ${dev.successRate}`);
});

assert("agent metrics include cost efficiency", () => {
  const metrics = perfMod.computeAgentMetrics({ root: tmp });
  const dev = metrics.find(m => m.roleId === "developer");
  if (typeof dev.costPerTask !== "number") throw new Error("no costPerTask");
  if (typeof dev.tokensPerTask !== "number") throw new Error("no tokensPerTask");
});

assert("computeOrgPerformance returns aggregated metrics", () => {
  if (typeof perfMod.computeOrgPerformance !== "function") throw new Error("missing");
  const perf = perfMod.computeOrgPerformance({ root: tmp });
  if (typeof perf.totalTasks !== "number") throw new Error("no totalTasks");
  if (typeof perf.overallSuccessRate !== "number") throw new Error("no overallSuccessRate");
  if (typeof perf.totalCost !== "number") throw new Error("no totalCost");
});

// ── Part 2: Standup Generator ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Standup Generator\x1b[0m");

const standupLib = join(process.cwd(), "tools/ogu/commands/lib/standup-generator.mjs");
assert("standup-generator.mjs exists", () => {
  if (!existsSync(standupLib)) throw new Error("file missing");
});

const standupMod = await import(standupLib);

assert("generateStandup returns structured standup report", () => {
  if (typeof standupMod.generateStandup !== "function") throw new Error("missing");
  const standup = standupMod.generateStandup({ root: tmp });
  if (!standup.date) throw new Error("no date");
  if (!Array.isArray(standup.completed)) throw new Error("no completed");
  if (!Array.isArray(standup.failed)) throw new Error("no failed");
  if (!Array.isArray(standup.inProgress)) throw new Error("no inProgress");
});

assert("standup includes completed tasks from audit", () => {
  const standup = standupMod.generateStandup({ root: tmp, hoursBack: 48 });
  if (standup.completed.length < 1) throw new Error("should have completed tasks");
});

assert("standup includes failed tasks from audit", () => {
  const standup = standupMod.generateStandup({ root: tmp, hoursBack: 48 });
  if (standup.failed.length < 1) throw new Error("should have failed tasks");
});

// ── Part 3: CLI ──────────────────────────────

console.log("\n\x1b[36m  Part 3: CLI Commands\x1b[0m");

assert("performance:index shows agent metrics via CLI", () => {
  const out = ogu("performance:index");
  if (!out.includes("developer") && !out.includes("Developer")) throw new Error(`unexpected: ${out}`);
});

assert("performance:index --json returns structured data", () => {
  const out = ogu("performance:index", ["--json"]);
  const data = JSON.parse(out);
  if (!Array.isArray(data)) throw new Error("not array");
});

assert("kadima:standup generates standup via CLI", () => {
  const out = ogu("kadima:standup");
  if (!out.includes("Standup") && !out.includes("standup")) throw new Error(`unexpected: ${out}`);
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
