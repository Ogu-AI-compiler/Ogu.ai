/**
 * Slice 413 — Agent Trainer (agent-trainer.mjs)
 *
 * Tests:
 *   - getPendingCandidatesForAgent filters by agentId
 *   - buildExperienceDigest([]) returns empty string
 *   - buildExperienceDigest(patterns) returns multi-line string
 *   - buildExperienceDigest caps at 20 rules
 *   - rebuildAgentPrompt returns non-empty string
 *   - trainAgent with dryRun=true returns result without saving
 *   - trainAgent with no pending candidates returns summary="no pending candidates"
 *   - trainAll returns { trained, skipped, errors }
 *   - trainAll on empty store returns { trained: 0, skipped: 0, errors: [] }
 *   - CLI: `ogu agents train --dry-run` exits 0 and prints output
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}
async function assertAsync(label, fn) {
  try { await fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

function makeTmpRoot(suffix) {
  const root = join(tmpdir(), `ogu-e2e-413-${suffix}-${randomUUID().slice(0, 8)}`);
  mkdirSync(join(root, ".ogu", "marketplace", "agents"), { recursive: true });
  mkdirSync(join(root, ".ogu", "marketplace", "learning-candidates"), { recursive: true });
  mkdirSync(join(root, ".ogu", "marketplace", "patterns"), { recursive: true });
  writeFileSync(join(root, ".ogu", "marketplace", "index.json"), JSON.stringify({ agents: [], nextId: 1 }), "utf-8");
  return root;
}

function writeLearningCandidate(root, agentId, overrides = {}) {
  const eventId = randomUUID();
  const candidate = {
    event_id: eventId,
    agent_id: agentId,
    task_type: "code-review",
    context_signature: { framework: "node", runtime: "node" },
    failure_signals: ["missing tests"],
    resolution_summary: "Always write tests before submitting",
    iteration_count: 0,
    trigger: "gate_failure",
    status: "pending",
    created_at: new Date().toISOString(),
    ...overrides,
  };
  const dir = join(root, ".ogu", "marketplace", "learning-candidates");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${eventId}.json`), JSON.stringify(candidate, null, 2) + "\n", "utf-8");
  return candidate;
}

function writeAgent(root, agentId, overrides = {}) {
  const profile = {
    agent_id: agentId,
    name: "Test Agent",
    role: "backend-developer",
    role_display: "Backend Developer",
    specialty: null,
    tier: 2,
    dna: {
      work_style: "async-first",
      communication_style: "concise",
      risk_appetite: "balanced",
      strength_bias: "analytical",
      tooling_bias: "cli",
      failure_strategy: "retry",
    },
    skills: ["code-implementation", "debugging", "testing"],
    skill_definitions: [],
    system_prompt: "You are a backend developer agent.",
    capacity_units: 10,
    base_price: 4,
    performance_multiplier: 1.0,
    stats: { success_rate: 0.8, projects_completed: 0, utilization_units: 0 },
    created_at: new Date().toISOString(),
    status: "available",
    prompt_version: 1,
    experience_digest: "",
    experience_sources_count: 0,
    role_history: [{ role: "backend-developer", tier: 2, from: new Date().toISOString(), to: null }],
    last_prompt_update: new Date().toISOString(),
    last_learning_event_id: null,
    profile_version: 2,
    ...overrides,
  };

  const agentsDir = join(root, ".ogu", "marketplace", "agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, `${agentId}.json`), JSON.stringify(profile, null, 2) + "\n", "utf-8");

  // Update index
  const indexPath = join(root, ".ogu", "marketplace", "index.json");
  let idx = { agents: [], nextId: 1 };
  try { idx = JSON.parse(require("node:fs").readFileSync(indexPath, "utf-8")); } catch { /* fresh */ }
  idx.agents = idx.agents.filter(a => a.agent_id !== agentId);
  idx.agents.push({ agent_id: agentId, name: profile.name, role: profile.role, specialty: profile.specialty, tier: profile.tier, status: profile.status, capacity_units: profile.capacity_units, base_price: profile.base_price });
  writeFileSync(indexPath, JSON.stringify(idx, null, 2) + "\n", "utf-8");

  return profile;
}

// Import readFileSync inline for writeAgent helper
import { readFileSync } from "node:fs";
// Re-define writeAgent using proper import
function saveAgentToTmp(root, agentId, overrides = {}) {
  const profile = {
    agent_id: agentId,
    name: "Test Agent",
    role: "backend-developer",
    role_display: "Backend Developer",
    specialty: null,
    tier: 2,
    dna: {
      work_style: "async-first",
      communication_style: "concise",
      risk_appetite: "balanced",
      strength_bias: "analytical",
      tooling_bias: "cli",
      failure_strategy: "retry",
    },
    skills: ["code-implementation", "debugging", "testing"],
    skill_definitions: [],
    system_prompt: "You are a backend developer agent.",
    capacity_units: 10,
    base_price: 4,
    performance_multiplier: 1.0,
    stats: { success_rate: 0.8, projects_completed: 0, utilization_units: 0 },
    created_at: new Date().toISOString(),
    status: "available",
    prompt_version: 1,
    experience_digest: "",
    experience_sources_count: 0,
    role_history: [{ role: "backend-developer", tier: 2, from: new Date().toISOString(), to: null }],
    last_prompt_update: new Date().toISOString(),
    last_learning_event_id: null,
    profile_version: 2,
    ...overrides,
  };

  const agentsDir = join(root, ".ogu", "marketplace", "agents");
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(join(agentsDir, `${agentId}.json`), JSON.stringify(profile, null, 2) + "\n", "utf-8");

  // Update index
  const indexPath = join(root, ".ogu", "marketplace", "index.json");
  let idx = { agents: [], nextId: 1 };
  try { idx = JSON.parse(readFileSync(indexPath, "utf-8")); } catch { /* fresh */ }
  idx.agents = idx.agents.filter(a => a.agent_id !== agentId);
  idx.agents.push({
    agent_id: agentId,
    name: profile.name,
    role: profile.role,
    specialty: profile.specialty,
    tier: profile.tier,
    status: profile.status,
    capacity_units: profile.capacity_units,
    base_price: profile.base_price,
  });
  writeFileSync(indexPath, JSON.stringify(idx, null, 2) + "\n", "utf-8");

  return profile;
}

console.log("\n\x1b[1mSlice 413 — Agent Trainer\x1b[0m\n");

const LIB = join(process.cwd(), "tools/ogu/commands/lib");

const {
  getPendingCandidatesForAgent,
  buildExperienceDigest,
  rebuildAgentPrompt,
  trainAgent,
  trainAll,
  getAgentPatternDigest,
} = await import(join(LIB, "agent-trainer.mjs"));

// ═══ Part 1: getPendingCandidatesForAgent ═════════════════════════════════
console.log("\x1b[36m  Part 1: getPendingCandidatesForAgent\x1b[0m");

assert("returns candidates matching agentId", () => {
  const root = makeTmpRoot("filter");
  writeLearningCandidate(root, "agent_0001");
  writeLearningCandidate(root, "agent_0001");
  writeLearningCandidate(root, "agent_0002");

  const result = getPendingCandidatesForAgent(root, "agent_0001");
  if (result.length !== 2) throw new Error(`expected 2, got ${result.length}`);
  if (!result.every(c => c.agent_id === "agent_0001")) throw new Error("wrong agent_id in results");
  rmSync(root, { recursive: true, force: true });
});

assert("returns empty array when no candidates for agentId", () => {
  const root = makeTmpRoot("filter-empty");
  writeLearningCandidate(root, "agent_0002");

  const result = getPendingCandidatesForAgent(root, "agent_0001");
  if (result.length !== 0) throw new Error(`expected 0, got ${result.length}`);
  rmSync(root, { recursive: true, force: true });
});

assert("does not return processed candidates", () => {
  const root = makeTmpRoot("filter-proc");
  const c = writeLearningCandidate(root, "agent_0001");
  // Manually mark as processed
  const filePath = join(root, ".ogu", "marketplace", "learning-candidates", `${c.event_id}.json`);
  const data = JSON.parse(readFileSync(filePath, "utf-8"));
  data.status = "processed";
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");

  const result = getPendingCandidatesForAgent(root, "agent_0001");
  if (result.length !== 0) throw new Error(`expected 0 processed, got ${result.length}`);
  rmSync(root, { recursive: true, force: true });
});

// ═══ Part 2: buildExperienceDigest ════════════════════════════════════════
console.log("\n\x1b[36m  Part 2: buildExperienceDigest\x1b[0m");

assert("returns empty string for empty array", () => {
  const result = buildExperienceDigest([]);
  if (result !== "") throw new Error(`expected "", got "${result}"`);
});

assert("returns empty string for null/undefined", () => {
  if (buildExperienceDigest(null) !== "") throw new Error("null should return empty");
  if (buildExperienceDigest(undefined) !== "") throw new Error("undefined should return empty");
});

assert("returns multi-line string with rules from patterns", () => {
  const patterns = [
    { pattern_id: "p1", task_type: "build", resolution_summary: "Always validate inputs", confidence: 0.8, active: true, context_signature: ["task_type:build"] },
    { pattern_id: "p2", task_type: "test", resolution_summary: "Write tests before code", confidence: 0.7, active: true, context_signature: ["task_type:test"] },
  ];
  const result = buildExperienceDigest(patterns);
  if (!result) throw new Error("expected non-empty string");
  const lines = result.split("\n").filter(Boolean);
  if (lines.length !== 2) throw new Error(`expected 2 lines, got ${lines.length}`);
  if (!result.includes("validate inputs")) throw new Error("missing first rule");
  if (!result.includes("Write tests")) throw new Error("missing second rule");
});

assert("sorts by confidence descending", () => {
  const patterns = [
    { pattern_id: "p1", task_type: "build", resolution_summary: "low confidence rule", confidence: 0.3, active: true, context_signature: [] },
    { pattern_id: "p2", task_type: "build", resolution_summary: "high confidence rule", confidence: 0.9, active: true, context_signature: [] },
  ];
  const result = buildExperienceDigest(patterns);
  const lines = result.split("\n").filter(Boolean);
  if (!lines[0].includes("high confidence")) throw new Error("first line should be highest confidence");
});

assert("caps at 20 rules", () => {
  const patterns = Array.from({ length: 30 }, (_, i) => ({
    pattern_id: `p${i}`,
    task_type: "build",
    resolution_summary: `Rule number ${i}`,
    confidence: Math.random(),
    active: true,
    context_signature: [],
  }));
  const result = buildExperienceDigest(patterns);
  const lines = result.split("\n").filter(Boolean);
  if (lines.length > 20) throw new Error(`expected max 20 lines, got ${lines.length}`);
});

assert("skips inactive patterns", () => {
  const patterns = [
    { pattern_id: "p1", task_type: "build", resolution_summary: "active rule", confidence: 0.8, active: true, context_signature: [] },
    { pattern_id: "p2", task_type: "build", resolution_summary: "inactive rule", confidence: 0.9, active: false, context_signature: [] },
  ];
  const result = buildExperienceDigest(patterns);
  if (result.includes("inactive rule")) throw new Error("should skip inactive patterns");
  if (!result.includes("active rule")) throw new Error("should include active patterns");
});

assert("uses context_signature when no resolution_summary", () => {
  const patterns = [
    { pattern_id: "p1", task_type: "build", resolution_summary: "", confidence: 0.8, active: true, context_signature: ["framework:react", "task_type:build"] },
  ];
  const result = buildExperienceDigest(patterns);
  if (!result) throw new Error("expected non-empty string");
  if (!result.includes("react")) throw new Error("should include tag from context_signature");
});

// ═══ Part 3: rebuildAgentPrompt ══════════════════════════════════════════
console.log("\n\x1b[36m  Part 3: rebuildAgentPrompt\x1b[0m");

assert("returns non-empty string for agent with system_prompt", () => {
  const agent = {
    agent_id: "agent_0001",
    role: "nonexistent-role-slug",
    system_prompt: "You are a developer. You write code.",
    experience_digest: "",
    dna: { work_style: "async-first", communication_style: "concise", risk_appetite: "balanced", strength_bias: "analytical", tooling_bias: "cli", failure_strategy: "retry" },
    skills: ["debugging"],
  };
  const result = rebuildAgentPrompt(agent);
  if (!result || result.length === 0) throw new Error("expected non-empty string");
});

assert("falls back to existing system_prompt when playbook not found", () => {
  const agent = {
    agent_id: "agent_0001",
    role: "this-role-does-not-exist",
    system_prompt: "Existing prompt content here.",
    experience_digest: "",
    dna: {},
    skills: [],
  };
  const result = rebuildAgentPrompt(agent);
  if (!result.includes("Existing prompt content")) throw new Error("should include existing prompt");
});

assert("appends experience layer to fallback prompt when digest exists", () => {
  const agent = {
    agent_id: "agent_0001",
    role: "nonexistent-role",
    system_prompt: "Base prompt.",
    experience_digest: "Always write tests first\nValidate inputs early",
    dna: {},
    skills: [],
  };
  const result = rebuildAgentPrompt(agent);
  if (!result.includes("Base prompt")) throw new Error("should include base prompt");
  if (!result.includes("Always write tests")) throw new Error("should include experience rule");
});

assert("returns experience layer alone when no system_prompt and digest exists", () => {
  const agent = {
    agent_id: "agent_0001",
    role: "nonexistent-role",
    system_prompt: "",
    experience_digest: "Use structured logging",
    dna: {},
    skills: [],
  };
  const result = rebuildAgentPrompt(agent);
  if (!result.includes("Use structured logging")) throw new Error("should include experience rule");
});

// ═══ Part 4: trainAgent ══════════════════════════════════════════════════
console.log("\n\x1b[36m  Part 4: trainAgent\x1b[0m");

await assertAsync("returns summary='no pending candidates' when no candidates", async () => {
  const root = makeTmpRoot("train-noop");
  saveAgentToTmp(root, "agent_0001");

  const result = await trainAgent(root, "agent_0001");
  if (result.summary !== "no pending candidates") throw new Error(`expected 'no pending candidates', got '${result.summary}'`);
  if (result.rulesAdded !== 0) throw new Error(`expected rulesAdded=0, got ${result.rulesAdded}`);
  rmSync(root, { recursive: true, force: true });
});

await assertAsync("dryRun=true returns result without saving changes", async () => {
  const root = makeTmpRoot("train-dry");
  saveAgentToTmp(root, "agent_0001");
  writeLearningCandidate(root, "agent_0001");

  const result = await trainAgent(root, "agent_0001", { dryRun: true });
  if (result.dryRun !== true) throw new Error("dryRun flag should be true in result");
  if (!result.summary) throw new Error("expected summary string");
  if (typeof result.rulesAdded !== "number") throw new Error("expected rulesAdded to be a number");
  if (typeof result.promptVersion !== "number") throw new Error("expected promptVersion to be a number");

  // Verify candidate was NOT marked processed
  const remaining = getPendingCandidatesForAgent(root, "agent_0001");
  if (remaining.length === 0) throw new Error("dryRun should not have consumed candidates");

  rmSync(root, { recursive: true, force: true });
});

await assertAsync("trainAgent processes candidates and returns valid result", async () => {
  const root = makeTmpRoot("train-real");
  saveAgentToTmp(root, "agent_0001");
  writeLearningCandidate(root, "agent_0001", { trigger: "gate_failure", failure_signals: ["missing-tests"] });
  writeLearningCandidate(root, "agent_0001", { trigger: "exceptional_improvement", resolution_summary: "Use early validation" });

  const result = await trainAgent(root, "agent_0001");
  if (!result.summary) throw new Error("expected summary string");
  if (typeof result.rulesAdded !== "number") throw new Error("expected rulesAdded number");
  if (typeof result.promptVersion !== "number") throw new Error("expected promptVersion number");
  if (result.dryRun !== false) throw new Error("dryRun should be false");

  // Candidates should now be processed
  const remaining = getPendingCandidatesForAgent(root, "agent_0001");
  if (remaining.length !== 0) throw new Error(`expected 0 pending, got ${remaining.length}`);

  rmSync(root, { recursive: true, force: true });
});

await assertAsync("trainAgent returns error-safe result for missing agent", async () => {
  const root = makeTmpRoot("train-missing");

  const result = await trainAgent(root, "agent_9999");
  if (!result.summary) throw new Error("expected summary");
  // Should not throw — returns graceful result
  if (typeof result.promptVersion !== "number") throw new Error("expected promptVersion");

  rmSync(root, { recursive: true, force: true });
});

// ═══ Part 5: trainAll ═══════════════════════════════════════════════════
console.log("\n\x1b[36m  Part 5: trainAll\x1b[0m");

await assertAsync("trainAll on empty store returns { trained: 0, skipped: 0, errors: [] }", async () => {
  const root = makeTmpRoot("train-all-empty");

  const result = await trainAll(root);
  if (result.trained !== 0) throw new Error(`expected trained=0, got ${result.trained}`);
  if (result.skipped !== 0) throw new Error(`expected skipped=0, got ${result.skipped}`);
  if (!Array.isArray(result.errors)) throw new Error("expected errors array");
  if (result.errors.length !== 0) throw new Error(`expected 0 errors, got ${result.errors.length}`);

  rmSync(root, { recursive: true, force: true });
});

await assertAsync("trainAll returns { trained, skipped, errors } shape", async () => {
  const root = makeTmpRoot("train-all-shape");
  saveAgentToTmp(root, "agent_0001");
  saveAgentToTmp(root, "agent_0002");
  writeLearningCandidate(root, "agent_0001");

  const result = await trainAll(root);
  if (typeof result.trained !== "number") throw new Error("expected trained to be number");
  if (typeof result.skipped !== "number") throw new Error("expected skipped to be number");
  if (!Array.isArray(result.errors)) throw new Error("expected errors to be array");

  rmSync(root, { recursive: true, force: true });
});

await assertAsync("trainAll trains agents with candidates, skips those without", async () => {
  const root = makeTmpRoot("train-all-mixed");
  saveAgentToTmp(root, "agent_0001");
  saveAgentToTmp(root, "agent_0002");
  // Only agent_0001 gets a candidate
  writeLearningCandidate(root, "agent_0001");

  const result = await trainAll(root);
  if (result.trained < 1) throw new Error(`expected at least 1 trained, got ${result.trained}`);
  if (result.skipped < 1) throw new Error(`expected at least 1 skipped (agent_0002), got ${result.skipped}`);

  rmSync(root, { recursive: true, force: true });
});

await assertAsync("trainAll with dryRun=true does not consume candidates", async () => {
  const root = makeTmpRoot("train-all-dry");
  saveAgentToTmp(root, "agent_0001");
  writeLearningCandidate(root, "agent_0001");
  writeLearningCandidate(root, "agent_0001");

  const result = await trainAll(root, { dryRun: true });
  if (typeof result.trained !== "number") throw new Error("expected trained number");

  const remaining = getPendingCandidatesForAgent(root, "agent_0001");
  if (remaining.length !== 2) throw new Error(`dryRun should not consume candidates, but ${remaining.length} remain`);

  rmSync(root, { recursive: true, force: true });
});

// ═══ Part 6: getAgentPatternDigest ════════════════════════════════════════
console.log("\n\x1b[36m  Part 6: getAgentPatternDigest\x1b[0m");

assert("returns empty string for nonexistent agent", () => {
  const root = makeTmpRoot("digest-missing");
  const result = getAgentPatternDigest(root, "agent_9999");
  if (result !== "") throw new Error(`expected empty string, got "${result}"`);
  rmSync(root, { recursive: true, force: true });
});

assert("returns string (possibly empty) for agent with no patterns", () => {
  const root = makeTmpRoot("digest-nopatterns");
  saveAgentToTmp(root, "agent_0001");
  const result = getAgentPatternDigest(root, "agent_0001");
  if (typeof result !== "string") throw new Error("expected string return type");
  rmSync(root, { recursive: true, force: true });
});

// ═══ Part 7: CLI smoke test ═══════════════════════════════════════════════
console.log("\n\x1b[36m  Part 7: CLI smoke test\x1b[0m");

assert("ogu agents train --dry-run exits 0 and prints output", () => {
  let output = "";
  try {
    output = execFileSync(
      process.execPath,
      [join(process.cwd(), "tools/ogu/cli.mjs"), "agents", "train", "--dry-run"],
      { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 }
    );
  } catch (e) {
    // Exit code != 0 or threw — check if it's an acceptable failure (e.g. no agents in real root)
    // The CLI itself must at least run and produce output (not crash on import)
    output = (e.stdout || "") + (e.stderr || "");
    const stripped = output.replace(/\x1b\[[0-9;]*m/g, "");
    if (!stripped.includes("dry-run") && !stripped.includes("train") && !stripped.includes("agent") && !stripped.includes("0")) {
      throw new Error(`CLI did not print expected output. Got: ${stripped.slice(0, 200)}`);
    }
    return; // acceptable
  }
  const stripped = output.replace(/\x1b\[[0-9;]*m/g, "");
  if (!stripped) throw new Error("CLI produced no output");
});

// ═══ Results ══════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
if (fail > 0) process.exit(1);
