/**
 * Slice 390 — Agent Trainer Core
 */

import { distillExperience, compressExperience, evaluateTierChange, trainAgent, trainAll } from "../../tools/ogu/commands/lib/agent-trainer.mjs";
import { saveAgent, loadAgent } from "../../tools/ogu/commands/lib/agent-store.mjs";
import { createLearningCandidate } from "../../tools/ogu/commands/lib/learning-event.mjs";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
const pending = [];
function assert(label, fn) {
  const result = (() => { try { return fn(); } catch (e) { return e; } })();
  if (result instanceof Promise) {
    pending.push(result.then(() => { pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); },
      e => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }));
  } else if (result instanceof Error) {
    fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${result.message}`);
  } else {
    pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  }
}

console.log("\n\x1b[1mSlice 390 — Agent Trainer Core\x1b[0m\n");

function makeRoot() {
  const root = join(tmpdir(), `ogu-390-${randomUUID().slice(0,8)}`);
  mkdirSync(join(root, ".ogu/marketplace/agents"), { recursive: true });
  return root;
}

// ── distillExperience ──

assert("distillExperience creates rules from gate_failure events", () => {
  const events = [{
    trigger: "gate_failure",
    task_type: "build",
    failure_signals: ["lint_error"],
    resolution_summary: "Fixed lint",
  }];
  const digest = distillExperience(events);
  if (!digest.includes("build")) throw new Error("missing task type");
  if (!digest.includes("lint_error")) throw new Error("missing signal");
});

assert("distillExperience creates rules from excessive_iterations", () => {
  const events = [{
    trigger: "excessive_iterations",
    task_type: "deploy",
    iteration_count: 5,
    resolution_summary: "Reduced retries",
  }];
  const digest = distillExperience(events);
  if (!digest.includes("deploy")) throw new Error("missing task type");
  if (!digest.includes("5")) throw new Error("missing iteration count");
});

assert("distillExperience appends to existing digest", () => {
  const events = [{ trigger: "gate_failure", task_type: "test", failure_signals: ["timeout"] }];
  const digest = distillExperience(events, "Existing rule 1");
  if (!digest.includes("Existing rule 1")) throw new Error("lost existing");
  if (!digest.includes("test")) throw new Error("missing new rule");
});

assert("distillExperience deduplicates rules", () => {
  const events = [
    { trigger: "gate_failure", task_type: "build", failure_signals: ["lint"] },
    { trigger: "gate_failure", task_type: "build", failure_signals: ["lint"] },
  ];
  const digest = distillExperience(events);
  const lines = digest.split("\n").filter(Boolean);
  if (lines.length !== 1) throw new Error(`got ${lines.length} lines, expected 1`);
});

assert("distillExperience handles empty events", () => {
  const digest = distillExperience([]);
  if (digest !== "") throw new Error("should be empty");
});

// ── compressExperience ──

assert("compressExperience keeps all rules under limit", () => {
  const digest = "Rule 1\nRule 2\nRule 3";
  const compressed = compressExperience(digest, 10);
  if (compressed !== digest) throw new Error("should not modify under limit");
});

assert("compressExperience truncates over limit", () => {
  const rules = Array.from({ length: 60 }, (_, i) => `Rule ${i}`).join("\n");
  const compressed = compressExperience(rules, 50);
  const lines = compressed.split("\n").filter(Boolean);
  if (lines.length !== 50) throw new Error(`got ${lines.length}`);
});

assert("compressExperience handles empty", () => {
  const result = compressExperience("");
  if (result !== "") throw new Error("should be empty");
});

// ── evaluateTierChange ──

assert("evaluateTierChange promotes high-performing tier 1 agent", () => {
  const agent = { tier: 1, stats: { success_rate: 0.95, projects_completed: 6 } };
  const result = evaluateTierChange(agent, []);
  if (result.action !== "promote") throw new Error(`got ${result.action}`);
});

assert("evaluateTierChange does not promote tier 4 agent", () => {
  const agent = { tier: 4, stats: { success_rate: 0.99, projects_completed: 100 } };
  const result = evaluateTierChange(agent, []);
  if (result.action !== "none") throw new Error(`got ${result.action}`);
});

assert("evaluateTierChange demotes low-performing agent", () => {
  const agent = { tier: 2, stats: { success_rate: 0.4, projects_completed: 5 } };
  const result = evaluateTierChange(agent, []);
  if (result.action !== "demote") throw new Error(`got ${result.action}`);
});

assert("evaluateTierChange does not demote tier 1", () => {
  const agent = { tier: 1, stats: { success_rate: 0.3, projects_completed: 5 } };
  const result = evaluateTierChange(agent, []);
  if (result.action !== "none") throw new Error(`got ${result.action}`);
});

assert("evaluateTierChange returns none for average performance", () => {
  const agent = { tier: 2, stats: { success_rate: 0.8, projects_completed: 3 } };
  const result = evaluateTierChange(agent, []);
  if (result.action !== "none") throw new Error(`got ${result.action}`);
});

assert("evaluateTierChange includes reason", () => {
  const agent = { tier: 1, stats: { success_rate: 0.95, projects_completed: 6 } };
  const result = evaluateTierChange(agent, []);
  if (!result.reason) throw new Error("missing reason");
});

// ── trainAgent ──

assert("trainAgent returns no-op for agent without candidates", async () => {
  const root = makeRoot();
  const profile = {
    agent_id: null, name: "Test", role: "qa", tier: 1,
    profile_version: 2, stats: { success_rate: 0.8, projects_completed: 0 },
    experience_digest: "", experience_sources_count: 0,
  };
  const saved = saveAgent(root, profile);
  const result = await trainAgent(root, saved.agent_id);
  if (result.trained) throw new Error("should not train without candidates");
  rmSync(root, { recursive: true, force: true });
});

assert("trainAgent processes pending candidates", async () => {
  const root = makeRoot();
  const profile = {
    agent_id: null, name: "Test", role: "qa", tier: 1,
    profile_version: 2, stats: { success_rate: 0.8, projects_completed: 0 },
    experience_digest: "", experience_sources_count: 0,
    prompt_version: 1,
  };
  const saved = saveAgent(root, profile);

  // Create learning candidate
  createLearningCandidate(root, {
    agentId: saved.agent_id,
    taskType: "build",
    contextSignature: [],
    failureSignals: ["lint_error"],
    resolutionSummary: "Fixed lint",
    iterationCount: 1,
    trigger: "gate_failure",
  });

  const result = await trainAgent(root, saved.agent_id);
  if (!result.trained) throw new Error("should train");
  if (result.candidateCount !== 1) throw new Error(`got ${result.candidateCount}`);

  // Verify experience updated
  const updated = loadAgent(root, saved.agent_id);
  if (!updated.experience_digest) throw new Error("digest should be updated");
  if (updated.experience_sources_count !== 1) throw new Error(`sources: ${updated.experience_sources_count}`);
  if (updated.prompt_version <= 1) throw new Error("prompt_version should be bumped");
  rmSync(root, { recursive: true, force: true });
});

assert("trainAgent dry-run does not modify agent", async () => {
  const root = makeRoot();
  const profile = {
    agent_id: null, name: "Test", role: "qa", tier: 1,
    profile_version: 2, stats: { success_rate: 0.8, projects_completed: 0 },
    experience_digest: "", experience_sources_count: 0,
    prompt_version: 1,
  };
  const saved = saveAgent(root, profile);
  createLearningCandidate(root, {
    agentId: saved.agent_id, taskType: "build", trigger: "gate_failure",
    failureSignals: ["err"], resolutionSummary: "fixed",
  });

  const result = await trainAgent(root, saved.agent_id, { dryRun: true });
  if (result.trained) throw new Error("dry-run should not train");
  const unchanged = loadAgent(root, saved.agent_id);
  if (unchanged.prompt_version !== 1) throw new Error("should not modify in dry-run");
  rmSync(root, { recursive: true, force: true });
});

assert("trainAgent creates trainer log", async () => {
  const root = makeRoot();
  const profile = {
    agent_id: null, name: "Test", role: "qa", tier: 1,
    profile_version: 2, stats: { success_rate: 0.8, projects_completed: 0 },
    experience_digest: "", prompt_version: 0, experience_sources_count: 0,
  };
  const saved = saveAgent(root, profile);
  createLearningCandidate(root, {
    agentId: saved.agent_id, taskType: "test", trigger: "gate_failure",
    failureSignals: ["fail"], resolutionSummary: "fixed",
  });

  await trainAgent(root, saved.agent_id);
  const logPath = join(root, ".ogu/marketplace/trainer/training-log.jsonl");
  if (!existsSync(logPath)) throw new Error("training log not created");
  rmSync(root, { recursive: true, force: true });
});

assert("trainAgent returns not found for unknown agent", async () => {
  const root = makeRoot();
  const result = await trainAgent(root, "agent_9999");
  if (result.trained) throw new Error("should not train");
  if (!result.summary.includes("not found")) throw new Error("wrong summary");
  rmSync(root, { recursive: true, force: true });
});

// ── trainAll ──

assert("trainAll trains agents with pending candidates", async () => {
  const root = makeRoot();
  const p1 = saveAgent(root, {
    agent_id: null, name: "A1", role: "qa", tier: 1,
    profile_version: 2, stats: { success_rate: 0.8, projects_completed: 0 },
    experience_digest: "", experience_sources_count: 0, prompt_version: 0,
  });
  const p2 = saveAgent(root, {
    agent_id: null, name: "A2", role: "dev", tier: 1,
    profile_version: 2, stats: { success_rate: 0.8, projects_completed: 0 },
    experience_digest: "", experience_sources_count: 0, prompt_version: 0,
  });

  createLearningCandidate(root, { agentId: p1.agent_id, taskType: "build", trigger: "gate_failure", failureSignals: ["err"], resolutionSummary: "fix" });
  createLearningCandidate(root, { agentId: p2.agent_id, taskType: "test", trigger: "gate_failure", failureSignals: ["fail"], resolutionSummary: "fix" });

  const result = await trainAll(root);
  if (result.trained !== 2) throw new Error(`trained: ${result.trained}`);
  rmSync(root, { recursive: true, force: true });
});

await Promise.all(pending);
console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
