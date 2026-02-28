/**
 * Slice 55 — Task Dependency Resolver + Agent Lifecycle Manager
 *
 * Dependency resolver: topological sort, cycle detection, critical path.
 * Agent lifecycle: spawn, track status, graceful shutdown, heartbeat.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const tmp = join(tmpdir(), `ogu-slice55-${Date.now()}`);
mkdirSync(tmp, { recursive: true });
mkdirSync(join(tmp, ".ogu/audit"), { recursive: true });
mkdirSync(join(tmp, ".ogu/agents"), { recursive: true });
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

console.log("\n\x1b[1mSlice 55 — Task Dependency Resolver + Agent Lifecycle Manager\x1b[0m\n");
console.log("  Topological sort, cycle detection, agent spawn/track/shutdown\n");

// ── Part 1: Task Dependency Resolver ──────────────────────────────

console.log("\x1b[36m  Part 1: Task Dependency Resolver\x1b[0m");

const depLib = join(process.cwd(), "tools/ogu/commands/lib/task-dep-resolver.mjs");
assert("task-dep-resolver.mjs exists", () => {
  if (!existsSync(depLib)) throw new Error("file missing");
});

const depMod = await import(depLib);

assert("topoSort returns correct order", () => {
  if (typeof depMod.topoSort !== "function") throw new Error("missing");
  const tasks = [
    { id: "a", deps: [] },
    { id: "b", deps: ["a"] },
    { id: "c", deps: ["a"] },
    { id: "d", deps: ["b", "c"] },
  ];
  const order = depMod.topoSort(tasks);
  if (!Array.isArray(order)) throw new Error("should return array");
  const idxA = order.indexOf("a");
  const idxB = order.indexOf("b");
  const idxD = order.indexOf("d");
  if (idxA >= idxB) throw new Error("a should come before b");
  if (idxB >= idxD) throw new Error("b should come before d");
});

assert("topoSort detects cycles", () => {
  const tasks = [
    { id: "x", deps: ["z"] },
    { id: "y", deps: ["x"] },
    { id: "z", deps: ["y"] },
  ];
  try {
    depMod.topoSort(tasks);
    throw new Error("should throw on cycle");
  } catch (e) {
    if (!e.message.toLowerCase().includes("cycle")) throw e;
  }
});

assert("findCriticalPath returns longest path", () => {
  if (typeof depMod.findCriticalPath !== "function") throw new Error("missing");
  const tasks = [
    { id: "a", deps: [], duration: 2 },
    { id: "b", deps: ["a"], duration: 3 },
    { id: "c", deps: ["a"], duration: 1 },
    { id: "d", deps: ["b", "c"], duration: 2 },
  ];
  const cp = depMod.findCriticalPath(tasks);
  if (!Array.isArray(cp.path)) throw new Error("should have path");
  if (typeof cp.totalDuration !== "number") throw new Error("should have totalDuration");
  // Critical path: a(2) -> b(3) -> d(2) = 7
  if (cp.totalDuration !== 7) throw new Error(`expected 7, got ${cp.totalDuration}`);
});

assert("getExecutionWaves groups independent tasks", () => {
  if (typeof depMod.getExecutionWaves !== "function") throw new Error("missing");
  const tasks = [
    { id: "a", deps: [] },
    { id: "b", deps: [] },
    { id: "c", deps: ["a", "b"] },
    { id: "d", deps: ["c"] },
  ];
  const waves = depMod.getExecutionWaves(tasks);
  if (!Array.isArray(waves)) throw new Error("should return array");
  if (waves.length < 2) throw new Error("should have at least 2 waves");
  // Wave 0 should contain a and b (parallel)
  if (!waves[0].includes("a") || !waves[0].includes("b")) throw new Error("wave 0 should have a,b");
  // Wave 1 should contain c
  if (!waves[1].includes("c")) throw new Error("wave 1 should have c");
});

// ── Part 2: Agent Lifecycle Manager ──────────────────────────────

console.log("\n\x1b[36m  Part 2: Agent Lifecycle Manager\x1b[0m");

const lifecycleLib = join(process.cwd(), "tools/ogu/commands/lib/agent-lifecycle.mjs");
assert("agent-lifecycle.mjs exists", () => {
  if (!existsSync(lifecycleLib)) throw new Error("file missing");
});

const lifecycleMod = await import(lifecycleLib);

assert("createAgentManager returns manager", () => {
  if (typeof lifecycleMod.createAgentManager !== "function") throw new Error("missing");
  const mgr = lifecycleMod.createAgentManager({ root: tmp });
  if (typeof mgr.spawn !== "function") throw new Error("missing spawn");
  if (typeof mgr.getStatus !== "function") throw new Error("missing getStatus");
  if (typeof mgr.heartbeat !== "function") throw new Error("missing heartbeat");
  if (typeof mgr.shutdown !== "function") throw new Error("missing shutdown");
  if (typeof mgr.listAgents !== "function") throw new Error("missing listAgents");
});

assert("spawn creates agent entry", () => {
  const mgr = lifecycleMod.createAgentManager({ root: tmp });
  const agent = mgr.spawn({ roleId: "developer", taskId: "task-1", featureSlug: "auth" });
  if (!agent.agentId) throw new Error("missing agentId");
  if (agent.status !== "running") throw new Error(`expected running, got ${agent.status}`);
  if (agent.roleId !== "developer") throw new Error("wrong roleId");
});

assert("getStatus returns agent state", () => {
  const mgr = lifecycleMod.createAgentManager({ root: tmp });
  const agent = mgr.spawn({ roleId: "tester", taskId: "task-2", featureSlug: "auth" });
  const status = mgr.getStatus(agent.agentId);
  if (!status) throw new Error("should return status");
  if (status.status !== "running") throw new Error("should be running");
});

assert("heartbeat updates lastSeen", () => {
  const mgr = lifecycleMod.createAgentManager({ root: tmp });
  const agent = mgr.spawn({ roleId: "reviewer", taskId: "task-3", featureSlug: "pay" });
  const before = mgr.getStatus(agent.agentId).lastSeen;
  mgr.heartbeat(agent.agentId);
  const after = mgr.getStatus(agent.agentId).lastSeen;
  if (after < before) throw new Error("lastSeen should increase");
});

assert("shutdown marks agent as stopped", () => {
  const mgr = lifecycleMod.createAgentManager({ root: tmp });
  const agent = mgr.spawn({ roleId: "developer", taskId: "task-4", featureSlug: "auth" });
  mgr.shutdown(agent.agentId, { reason: "task-complete" });
  const status = mgr.getStatus(agent.agentId);
  if (status.status !== "stopped") throw new Error(`expected stopped, got ${status.status}`);
});

assert("listAgents returns all agents", () => {
  const mgr = lifecycleMod.createAgentManager({ root: tmp });
  mgr.spawn({ roleId: "a", taskId: "t1", featureSlug: "f1" });
  mgr.spawn({ roleId: "b", taskId: "t2", featureSlug: "f2" });
  const list = mgr.listAgents();
  if (list.length < 2) throw new Error(`expected 2+, got ${list.length}`);
});

assert("AGENT_STATES defines valid states", () => {
  if (!lifecycleMod.AGENT_STATES) throw new Error("missing");
  const required = ["pending", "running", "stopped", "failed"];
  for (const s of required) {
    if (!lifecycleMod.AGENT_STATES.includes(s)) throw new Error(`missing state: ${s}`);
  }
});

// Cleanup
rmSync(tmp, { recursive: true, force: true });

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
