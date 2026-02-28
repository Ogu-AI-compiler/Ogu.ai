/**
 * Slice 29 — Failure Simulation + Formal Scheduling (P19 + P29)
 *
 * Failure Simulation: chaos injection mode for testing resilience.
 * Formal Scheduling: WFQ, priority classes, starvation prevention.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tmp = join(tmpdir(), `ogu-slice29-${Date.now()}`);
mkdirSync(tmp, { recursive: true });

mkdirSync(join(tmp, ".ogu/state/features"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents"), { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/budget"), { recursive: true });
writeFileSync(join(tmp, ".ogu/STATE.json"), JSON.stringify({ currentFeature: "chaos-test", phase: "build" }));
writeFileSync(join(tmp, ".ogu/CONTEXT.md"), "# Context\nChaos test");
writeFileSync(join(tmp, ".ogu/audit/current.jsonl"), "");

const orgSpec = {
  version: "1.0.0",
  org: { name: "ChaosCo" },
  roles: [
    { id: "developer", name: "Developer", department: "engineering", enabled: true, capabilities: ["code"], riskTier: "standard", maxTokensPerTask: 8000, sandbox: { allowNetwork: false, allowShell: false } },
  ],
  providers: [{ id: "anthropic", type: "anthropic", models: ["claude-sonnet-4-20250514"] }],
  budget: { dailyLimit: 50, monthlyLimit: 500 },
  governance: { requireApproval: [] },
};
writeFileSync(join(tmp, ".ogu/OrgSpec.json"), JSON.stringify(orgSpec, null, 2));

execFileSync("git", ["init"], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
execFileSync("git", ["commit", "-m", "init", "--no-gpg-sign"], { cwd: tmp, stdio: "ignore", env: { ...process.env, GIT_AUTHOR_NAME: "test", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "test", GIT_COMMITTER_EMAIL: "t@t" } });

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 29 — Failure Simulation + Formal Scheduling (P19 + P29)\x1b[0m\n");
console.log("  Chaos injection, priority scheduling, starvation prevention\n");

// ── Part 1: Failure Simulation ──────────────────────────────

console.log("\x1b[36m  Part 1: Failure Simulation Library\x1b[0m");

const chaosLib = join(process.cwd(), "tools/ogu/commands/lib/chaos-injection.mjs");
assert("chaos-injection.mjs exists", () => {
  if (!existsSync(chaosLib)) throw new Error("file missing");
});

const chaosMod = await import(chaosLib);

assert("FAILURE_MODES lists available chaos modes", () => {
  if (!chaosMod.FAILURE_MODES) throw new Error("missing");
  if (typeof chaosMod.FAILURE_MODES !== "object") throw new Error("not object");
  const modes = Object.keys(chaosMod.FAILURE_MODES);
  if (modes.length < 3) throw new Error(`expected at least 3 modes, got ${modes.length}`);
});

assert("injectFailure with budget-exceeded throws budget error", () => {
  if (typeof chaosMod.injectFailure !== "function") throw new Error("missing");
  let threw = false;
  try {
    chaosMod.injectFailure("budget-exceeded");
  } catch (e) {
    threw = true;
    if (!e.message.toLowerCase().includes("budget")) throw new Error(`wrong error: ${e.message}`);
  }
  if (!threw) throw new Error("should throw");
});

assert("injectFailure with timeout throws timeout error", () => {
  let threw = false;
  try {
    chaosMod.injectFailure("timeout");
  } catch (e) {
    threw = true;
    if (!e.message.toLowerCase().includes("timeout")) throw new Error(`wrong error: ${e.message}`);
  }
  if (!threw) throw new Error("should throw");
});

assert("shouldInject respects probability", () => {
  if (typeof chaosMod.shouldInject !== "function") throw new Error("missing");
  // With probability 0, should never inject
  const never = chaosMod.shouldInject(0);
  if (never) throw new Error("probability 0 should never inject");
  // With probability 1, should always inject
  const always = chaosMod.shouldInject(1);
  if (!always) throw new Error("probability 1 should always inject");
});

assert("createChaosConfig creates valid config", () => {
  if (typeof chaosMod.createChaosConfig !== "function") throw new Error("missing");
  const config = chaosMod.createChaosConfig({
    enabled: true,
    modes: ["budget-exceeded", "timeout"],
    probability: 0.1,
  });
  if (!config.enabled) throw new Error("not enabled");
  if (config.modes.length !== 2) throw new Error("wrong modes");
  if (config.probability !== 0.1) throw new Error("wrong probability");
});

// ── Part 2: Formal Scheduler ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Formal Scheduler\x1b[0m");

const schedLib = join(process.cwd(), "tools/ogu/commands/lib/formal-scheduler.mjs");
assert("formal-scheduler.mjs exists", () => {
  if (!existsSync(schedLib)) throw new Error("file missing");
});

const schedMod = await import(schedLib);

assert("PRIORITY_CLASSES lists priority levels", () => {
  if (!schedMod.PRIORITY_CLASSES) throw new Error("missing");
  const classes = Object.keys(schedMod.PRIORITY_CLASSES);
  if (classes.length < 3) throw new Error(`expected at least 3, got ${classes.length}`);
});

assert("createScheduler returns a scheduler instance", () => {
  if (typeof schedMod.createScheduler !== "function") throw new Error("missing");
  const sched = schedMod.createScheduler();
  if (typeof sched.enqueue !== "function") throw new Error("no enqueue");
  if (typeof sched.dequeue !== "function") throw new Error("no dequeue");
  if (typeof sched.size !== "function") throw new Error("no size");
});

assert("enqueue and dequeue respect priority ordering", () => {
  const sched = schedMod.createScheduler();
  sched.enqueue({ id: "low", priority: "low", taskId: "t1" });
  sched.enqueue({ id: "critical", priority: "critical", taskId: "t2" });
  sched.enqueue({ id: "normal", priority: "normal", taskId: "t3" });
  // Dequeue should return highest priority first
  const first = sched.dequeue();
  if (first.priority !== "critical") throw new Error(`expected critical, got ${first.priority}`);
  const second = sched.dequeue();
  if (second.priority !== "normal") throw new Error(`expected normal, got ${second.priority}`);
});

assert("starvation prevention promotes old low-priority tasks", () => {
  const sched = schedMod.createScheduler({ starvationThreshold: 2 });
  // Add low priority tasks with old timestamps
  sched.enqueue({ id: "old-low", priority: "low", taskId: "t-old", enqueuedAt: Date.now() - 100000 });
  sched.enqueue({ id: "new-high", priority: "high", taskId: "t-new" });
  // After starvation check, old-low should be promoted
  sched.checkStarvation();
  const first = sched.dequeue();
  // The old starved task should be promoted to high
  if (first.id !== "old-low") throw new Error(`expected old-low first (promoted), got ${first.id}`);
});

assert("scheduler size tracks queue correctly", () => {
  const sched = schedMod.createScheduler();
  if (sched.size() !== 0) throw new Error("should be empty");
  sched.enqueue({ id: "a", priority: "normal", taskId: "t1" });
  sched.enqueue({ id: "b", priority: "normal", taskId: "t2" });
  if (sched.size() !== 2) throw new Error(`expected 2, got ${sched.size()}`);
  sched.dequeue();
  if (sched.size() !== 1) throw new Error(`expected 1, got ${sched.size()}`);
});

assert("WFQ weight distribution works", () => {
  if (typeof schedMod.computeWFQWeights !== "function") throw new Error("missing");
  const weights = schedMod.computeWFQWeights({
    critical: 2,
    high: 3,
    normal: 5,
    low: 1,
  });
  // Critical should have highest per-task weight
  if (weights.critical <= weights.low) throw new Error("critical should have higher weight than low");
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
