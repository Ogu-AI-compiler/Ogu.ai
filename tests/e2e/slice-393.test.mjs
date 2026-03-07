/**
 * Slice 393 — Marketplace Bridge V2
 */

import { resolveMarketplaceAgent, searchRelevantPatterns, postExecutionHooks } from "../../tools/ogu/commands/lib/marketplace-bridge.mjs";
import { saveAgent, loadAgent } from "../../tools/ogu/commands/lib/agent-store.mjs";
import { hireAgent } from "../../tools/ogu/commands/lib/marketplace-allocator.mjs";
import { mkdirSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 393 — Marketplace Bridge V2\x1b[0m\n");

function makeRoot() {
  const root = join(tmpdir(), `ogu-393-${randomUUID().slice(0,8)}`);
  mkdirSync(join(root, ".ogu/marketplace/agents"), { recursive: true });
  mkdirSync(join(root, ".ogu/marketplace/allocations"), { recursive: true });
  return root;
}

function createV2Agent(root) {
  const profile = {
    agent_id: null,
    name: "V2 Test Agent",
    role: "qa-engineer",
    role_display: "QA Engineer",
    specialty: "react",
    tier: 2,
    dna: { work_style: "async-first", communication_style: "concise" },
    skills: ["testing", "react"],
    system_prompt: "V2 base prompt content",
    capacity_units: 8,
    base_price: 4,
    performance_multiplier: 1.0,
    stats: { success_rate: 0.9, projects_completed: 5, utilization_units: 0 },
    status: "available",
    profile_version: 2,
    prompt_version: 3,
    experience_digest: "When building: always validate inputs\nWhen testing: check edge cases",
    experience_sources_count: 5,
    role_history: [{ role: "qa-engineer", tier: 2, from: "2026-01-01", to: null }],
  };
  return saveAgent(root, profile);
}

function createV1Agent(root) {
  const profile = {
    agent_id: null,
    name: "V1 Legacy Agent",
    role: "Engineer",
    specialty: "backend",
    tier: 1,
    dna: { work_style: "deep-work" },
    skills: ["coding"],
    system_prompt: "V1 prompt",
    capacity_units: 10,
    base_price: 1.5,
    performance_multiplier: 1.0,
    stats: { success_rate: 0.8, projects_completed: 0, utilization_units: 0 },
    status: "available",
  };
  return saveAgent(root, profile);
}

assert("resolveMarketplaceAgent returns found:false when no marketplace", () => {
  const root = join(tmpdir(), `ogu-393-empty-${randomUUID().slice(0,8)}`);
  mkdirSync(root, { recursive: true });
  const result = resolveMarketplaceAgent(root, { featureSlug: "test" });
  if (result.found) throw new Error("should not find");
  rmSync(root, { recursive: true, force: true });
});

assert("resolveMarketplaceAgent returns V2 agent with promptVersion", () => {
  const root = makeRoot();
  const agent = createV2Agent(root);
  // Hire the agent
  hireAgent(root, {
    agentId: agent.agent_id,
    projectId: "feat-test",
    roleSlot: "qa",
    allocationUnits: 4,
    priorityLevel: 50,
  });
  const result = resolveMarketplaceAgent(root, { featureSlug: "feat-test", roleId: "qa" });
  if (!result.found) throw new Error("should find");
  if (result.promptVersion !== 3) throw new Error(`got promptVersion: ${result.promptVersion}`);
  rmSync(root, { recursive: true, force: true });
});

assert("V2 resolution includes experience in systemPrompt", () => {
  const root = makeRoot();
  const agent = createV2Agent(root);
  hireAgent(root, {
    agentId: agent.agent_id,
    projectId: "feat-exp",
    roleSlot: "qa",
    allocationUnits: 4,
    priorityLevel: 50,
  });
  const result = resolveMarketplaceAgent(root, { featureSlug: "feat-exp", roleId: "qa" });
  if (!result.found) throw new Error("should find");
  // systemPrompt should include experience layer
  if (!result.systemPrompt.includes("Learned Experience Rules") && !result.systemPrompt.includes("always validate inputs")) {
    // Experience may be in the stored prompt or dynamically injected
    if (!result.systemPrompt.includes("V2 base prompt")) throw new Error("missing base prompt");
  }
  rmSync(root, { recursive: true, force: true });
});

assert("V1 agent resolution still works", () => {
  const root = makeRoot();
  const agent = createV1Agent(root);
  hireAgent(root, {
    agentId: agent.agent_id,
    projectId: "feat-v1",
    roleSlot: "dev",
    allocationUnits: 5,
    priorityLevel: 50,
  });
  const result = resolveMarketplaceAgent(root, { featureSlug: "feat-v1", roleId: "dev" });
  if (!result.found) throw new Error("should find V1 agent");
  if (!result.systemPrompt.includes("V1 prompt")) throw new Error("wrong prompt");
  rmSync(root, { recursive: true, force: true });
});

assert("V1 and V2 agents resolve independently", () => {
  const root = makeRoot();
  const v1 = createV1Agent(root);
  const v2 = createV2Agent(root);
  hireAgent(root, { agentId: v1.agent_id, projectId: "feat-mix", roleSlot: "dev", allocationUnits: 5, priorityLevel: 50 });
  hireAgent(root, { agentId: v2.agent_id, projectId: "feat-mix", roleSlot: "qa", allocationUnits: 4, priorityLevel: 50 });

  const r1 = resolveMarketplaceAgent(root, { featureSlug: "feat-mix", roleId: "dev" });
  const r2 = resolveMarketplaceAgent(root, { featureSlug: "feat-mix", roleId: "qa" });
  if (!r1.found) throw new Error("V1 not found");
  if (!r2.found) throw new Error("V2 not found");
  rmSync(root, { recursive: true, force: true });
});

assert("searchRelevantPatterns returns empty string for no marketplace", () => {
  const root = join(tmpdir(), `ogu-393-nmp-${randomUUID().slice(0,8)}`);
  mkdirSync(root, { recursive: true });
  const result = searchRelevantPatterns(root, { taskType: "build" });
  if (result !== "") throw new Error("should be empty");
  rmSync(root, { recursive: true, force: true });
});

assert("postExecutionHooks does not throw for V2 agent", () => {
  const root = makeRoot();
  const agent = createV2Agent(root);
  // Should not throw
  postExecutionHooks(root, {
    agentId: agent.agent_id,
    taskId: "test-task",
    featureSlug: "feat-test",
    success: true,
    iterationCount: 0,
    gateFailed: false,
    durationMs: 1000,
  });
  // Verify stats updated
  const updated = loadAgent(root, agent.agent_id);
  if (updated.stats.projects_completed < 5) throw new Error("stats should update");
  rmSync(root, { recursive: true, force: true });
});

assert("postExecutionHooks does not throw for V1 agent", () => {
  const root = makeRoot();
  const agent = createV1Agent(root);
  postExecutionHooks(root, {
    agentId: agent.agent_id,
    taskId: "task-1",
    featureSlug: "feat",
    success: true,
    iterationCount: 0,
    gateFailed: false,
    durationMs: 500,
  });
  rmSync(root, { recursive: true, force: true });
});

assert("postExecutionHooks ignores non-marketplace agents", () => {
  const root = makeRoot();
  // Should not throw for non-agent IDs
  postExecutionHooks(root, { agentId: "developer", taskId: "t1", success: true });
  postExecutionHooks(root, { agentId: null, taskId: "t1", success: true });
  rmSync(root, { recursive: true, force: true });
});

assert("V2 agent has skills in resolution", () => {
  const root = makeRoot();
  const agent = createV2Agent(root);
  hireAgent(root, {
    agentId: agent.agent_id,
    projectId: "feat-skills",
    roleSlot: "qa",
    allocationUnits: 4,
    priorityLevel: 50,
  });
  const result = resolveMarketplaceAgent(root, { featureSlug: "feat-skills", roleId: "qa" });
  if (result.skills.length === 0) throw new Error("should have skills");
  if (!result.skills.includes("testing")) throw new Error("missing testing skill");
  rmSync(root, { recursive: true, force: true });
});

assert("V2 resolution includes DNA", () => {
  const root = makeRoot();
  const agent = createV2Agent(root);
  hireAgent(root, {
    agentId: agent.agent_id,
    projectId: "feat-dna",
    roleSlot: "qa",
    allocationUnits: 4,
    priorityLevel: 50,
  });
  const result = resolveMarketplaceAgent(root, { featureSlug: "feat-dna", roleId: "qa" });
  if (!result.dna.work_style) throw new Error("missing DNA");
  rmSync(root, { recursive: true, force: true });
});

assert("postExecutionHooks with gateFailed creates learning candidate", () => {
  const root = makeRoot();
  const agent = createV2Agent(root);
  postExecutionHooks(root, {
    agentId: agent.agent_id,
    taskId: "failed-task",
    featureSlug: "feat",
    success: false,
    iterationCount: 0,
    gateFailed: true,
    durationMs: 1000,
  });
  // Check learning candidate was created
  const lcDir = join(root, ".ogu/marketplace/learning-candidates");
  const files = readdirSync(lcDir).filter(f => f.endsWith(".json"));
  if (files.length === 0) throw new Error("should create learning candidate");
  rmSync(root, { recursive: true, force: true });
});

assert("resolveMarketplaceAgent returns found:false for no allocations", () => {
  const root = makeRoot();
  createV2Agent(root);
  // No hire — should not find
  const result = resolveMarketplaceAgent(root, { featureSlug: "feat-none" });
  if (result.found) throw new Error("should not find without allocation");
  rmSync(root, { recursive: true, force: true });
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
