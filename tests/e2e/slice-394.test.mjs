/**
 * Slice 394 — Full Integration Test
 * End-to-end lifecycle: generate V2 → hire → execute → train → verify prompt updated
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { generateAgentV2 } from "../../tools/ogu/commands/lib/agent-generator.mjs";
import { saveAgent, loadAgent, appendRoleHistory, updateExperience, bumpPromptVersion } from "../../tools/ogu/commands/lib/agent-store.mjs";
import { createLearningCandidate, listPendingCandidates } from "../../tools/ogu/commands/lib/learning-event.mjs";
import { trainAgent } from "../../tools/ogu/commands/lib/agent-trainer.mjs";
import { applyRoleChange, generalizeExperience } from "../../tools/ogu/commands/lib/role-evolution.mjs";
import { ROLE_TAXONOMY } from "../../tools/ogu/commands/lib/role-taxonomy.mjs";
import { resolveMarketplaceAgent } from "../../tools/ogu/commands/lib/marketplace-bridge.mjs";
import { hireAgent } from "../../tools/ogu/commands/lib/marketplace-allocator.mjs";
import { parsePlaybook } from "../../tools/ogu/commands/lib/playbook-loader.mjs";
import { fileURLToPath } from "node:url";

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

console.log("\n\x1b[1mSlice 394 — Full Integration Test\x1b[0m\n");

const thisFile = fileURLToPath(import.meta.url);
const pbDir = join(thisFile, "..", "..", "..", "tools", "ogu", "playbooks");

function makeRoot() {
  const root = join(tmpdir(), `ogu-394-${randomUUID().slice(0,8)}`);
  mkdirSync(join(root, ".ogu/marketplace/agents"), { recursive: true });
  mkdirSync(join(root, ".ogu/marketplace/allocations"), { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  return root;
}

function runCli(root, args) {
  return execFileSync("node", [
    join(process.cwd(), "tools/ogu/cli.mjs"),
    ...args,
  ], {
    env: { ...process.env, OGU_ROOT: root },
    maxBuffer: 5 * 1024 * 1024,
    encoding: "utf-8",
  });
}

// ── E2E: Generate → Hire → Execute → Train → Verify ──

assert("E2E: Generate V2 agent, hire, create learning event, train, verify prompt update", async () => {
  const root = makeRoot();

  // 1. Generate V2 agent
  const profile = generateAgentV2({
    roleSlug: "qa-engineer",
    specialtySlug: "react",
    tier: 1,
    seed: 42,
    playbooksDir: pbDir,
  });
  const saved = saveAgent(root, profile);
  if (saved.profile_version !== 2) throw new Error("not V2");
  const originalPromptVersion = saved.prompt_version;

  // 2. Hire
  hireAgent(root, {
    agentId: saved.agent_id,
    projectId: "feat-e2e",
    roleSlot: "qa",
    allocationUnits: 4,
    priorityLevel: 50,
  });

  // 3. Simulate task execution with learning trigger
  createLearningCandidate(root, {
    agentId: saved.agent_id,
    taskType: "integration-test",
    contextSignature: ["feat-e2e"],
    failureSignals: ["flaky_test"],
    resolutionSummary: "Added retry logic for flaky network calls",
    iterationCount: 4,
    trigger: "excessive_iterations",
  });

  // 4. Train
  const result = await trainAgent(root, saved.agent_id, { playbooksDir: pbDir });
  if (!result.trained) throw new Error("should train");

  // 5. Verify prompt updated
  const updated = loadAgent(root, saved.agent_id);
  if (updated.prompt_version <= originalPromptVersion) throw new Error("prompt should be bumped");
  if (!updated.experience_digest) throw new Error("experience should be set");
  if (updated.experience_sources_count !== 1) throw new Error(`sources: ${updated.experience_sources_count}`);

  rmSync(root, { recursive: true, force: true });
});

assert("E2E: Tier promotion changes price", async () => {
  const root = makeRoot();

  const profile = generateAgentV2({
    roleSlug: "frontend-developer",
    tier: 1,
    seed: 99,
    playbooksDir: pbDir,
  });
  // Set high success rate and enough projects
  profile.stats = { success_rate: 0.95, projects_completed: 6, utilization_units: 0 };
  const saved = saveAgent(root, profile);
  const originalTier = saved.tier;
  const originalPrice = saved.base_price;

  // Create candidate
  createLearningCandidate(root, {
    agentId: saved.agent_id,
    taskType: "build",
    trigger: "exceptional_improvement",
    resolutionSummary: "Optimized build pipeline",
  });

  await trainAgent(root, saved.agent_id, { playbooksDir: pbDir });
  const updated = loadAgent(root, saved.agent_id);

  if (updated.tier <= originalTier) throw new Error(`tier should increase: was ${originalTier}, now ${updated.tier}`);
  if (updated.base_price <= originalPrice) throw new Error("price should increase with tier");
  rmSync(root, { recursive: true, force: true });
});

assert("E2E: V1 and V2 agents coexist in same marketplace", () => {
  const root = makeRoot();

  // Create V1 via CLI
  runCli(root, ["agents", "generate", "Engineer", "backend", "2"]);

  // Create V2 via CLI
  runCli(root, ["agents", "generate-v2", "qa-engineer", "react", "1"]);

  // Both should appear in list
  const out = runCli(root, ["agents", "list"]);
  if (!out.includes("agent_0001")) throw new Error("missing V1 agent");
  if (!out.includes("agent_0002")) throw new Error("missing V2 agent");

  // V1 should auto-migrate on load
  const v1 = loadAgent(root, "agent_0001");
  if (v1.profile_version !== 2) throw new Error("V1 should auto-migrate to V2");

  rmSync(root, { recursive: true, force: true });
});

assert("E2E: Role history accumulates", () => {
  const root = makeRoot();
  const profile = generateAgentV2({ roleSlug: "qa-engineer", tier: 1, seed: 42, playbooksDir: pbDir });
  const saved = saveAgent(root, profile);

  // Add role history entries
  appendRoleHistory(root, saved.agent_id, { role: "test-automation", tier: 2 });
  appendRoleHistory(root, saved.agent_id, { role: "qa-lead", tier: 3 });

  const updated = loadAgent(root, saved.agent_id);
  if (updated.role_history.length !== 3) throw new Error(`got ${updated.role_history.length} entries`);
  // First entry should be closed
  if (updated.role_history[0].to === null) throw new Error("first entry should be closed");
  // Last entry should be open
  if (updated.role_history[2].to !== null) throw new Error("last entry should be open");
  rmSync(root, { recursive: true, force: true });
});

assert("E2E: Experience persists across training cycles", async () => {
  const root = makeRoot();
  const profile = generateAgentV2({ roleSlug: "devops-engineer", tier: 1, seed: 42, playbooksDir: pbDir });
  const saved = saveAgent(root, profile);

  // First training cycle
  createLearningCandidate(root, {
    agentId: saved.agent_id,
    taskType: "deploy",
    trigger: "gate_failure",
    failureSignals: ["timeout"],
    resolutionSummary: "Increased timeout",
  });
  await trainAgent(root, saved.agent_id, { playbooksDir: pbDir });

  const after1 = loadAgent(root, saved.agent_id);
  const digest1 = after1.experience_digest;
  if (!digest1) throw new Error("should have experience after first cycle");

  // Second training cycle
  createLearningCandidate(root, {
    agentId: saved.agent_id,
    taskType: "monitor",
    trigger: "gate_failure",
    failureSignals: ["alert_missing"],
    resolutionSummary: "Added alert rules",
  });
  await trainAgent(root, saved.agent_id, { playbooksDir: pbDir });

  const after2 = loadAgent(root, saved.agent_id);
  if (!after2.experience_digest.includes("timeout")) throw new Error("lost first experience");
  if (!after2.experience_digest.includes("alert")) throw new Error("missing second experience");
  if (after2.experience_sources_count < 2) throw new Error(`sources: ${after2.experience_sources_count}`);
  rmSync(root, { recursive: true, force: true });
});

assert("E2E: Agent with 0 experience has functional prompt", () => {
  const root = makeRoot();
  const profile = generateAgentV2({ roleSlug: "qa-engineer", specialtySlug: "react", tier: 1, seed: 42, playbooksDir: pbDir });
  const saved = saveAgent(root, profile);

  if (!saved.system_prompt) throw new Error("should have prompt");
  if (saved.system_prompt.length < 100) throw new Error("prompt too short");
  // Should have playbook content even without experience
  if (saved.experience_digest !== "") throw new Error("should start with empty experience");
  rmSync(root, { recursive: true, force: true });
});

assert("E2E: Role change generalizes experience and updates prompt", () => {
  const root = makeRoot();
  const profile = generateAgentV2({ roleSlug: "frontend-developer", specialtySlug: "react", tier: 2, seed: 42, playbooksDir: pbDir });
  profile.experience_digest = "React hooks must cleanup subscriptions\nUse Express middleware for auth";
  const saved = saveAgent(root, profile);

  const updated = applyRoleChange(root, saved.agent_id, "backend-architect", pbDir);

  // Experience should be generalized
  if (updated.experience_digest.includes("React")) throw new Error("React should be generalized");
  if (updated.role !== "backend-architect") throw new Error("role should change");
  if (updated.role_display !== "Backend Architect") throw new Error("display should change");
  rmSync(root, { recursive: true, force: true });
});

assert("E2E: Marketplace bridge resolves V2 agent with experience", () => {
  const root = makeRoot();
  const profile = generateAgentV2({ roleSlug: "security-architect", tier: 2, seed: 42, playbooksDir: pbDir });
  profile.experience_digest = "Always check OWASP top 10\nValidate all input boundaries";
  const saved = saveAgent(root, profile);

  hireAgent(root, {
    agentId: saved.agent_id,
    projectId: "feat-sec",
    roleSlot: "security",
    allocationUnits: 4,
    priorityLevel: 50,
  });

  const result = resolveMarketplaceAgent(root, { featureSlug: "feat-sec", roleId: "security" });
  if (!result.found) throw new Error("should find");
  if (result.promptVersion === undefined) throw new Error("should have promptVersion");
  rmSync(root, { recursive: true, force: true });
});

assert("E2E: Full CLI round-trip: populate-v2 → list → show → train", () => {
  const root = makeRoot();
  runCli(root, ["agents", "populate-v2", "--count=3"]);

  const listOut = runCli(root, ["agents", "list"]);
  if (!listOut.includes("3 found")) throw new Error("should list 3 agents");

  const idx = JSON.parse(readFileSync(join(root, ".ogu/marketplace/index.json"), "utf-8"));
  const showOut = runCli(root, ["agents", "show", idx.agents[0].agent_id]);
  if (!showOut.includes(idx.agents[0].agent_id)) throw new Error("show should display agent");

  const rolesOut = runCli(root, ["agents", "roles"]);
  if (!rolesOut.includes("64")) throw new Error("roles should list 64");

  const trainOut = runCli(root, ["agents", "train", "--dry-run"]);
  // Should complete without error even with no candidates

  rmSync(root, { recursive: true, force: true });
});

assert("ROLE_TAXONOMY has exactly 64 entries", () => {
  const count = Object.keys(ROLE_TAXONOMY).length;
  if (count !== 64) throw new Error(`got ${count}`);
});

assert("E2E: Trainer marks candidates as processed", async () => {
  const root = makeRoot();
  const profile = generateAgentV2({ roleSlug: "qa-engineer", tier: 1, seed: 42, playbooksDir: pbDir });
  const saved = saveAgent(root, profile);

  createLearningCandidate(root, {
    agentId: saved.agent_id,
    taskType: "test",
    trigger: "gate_failure",
    failureSignals: ["fail"],
    resolutionSummary: "fixed",
  });

  const before = listPendingCandidates(root);
  if (before.length === 0) throw new Error("should have pending candidate");

  await trainAgent(root, saved.agent_id, { playbooksDir: pbDir });

  const after = listPendingCandidates(root);
  const agentPending = after.filter(c => c.agent_id === saved.agent_id);
  if (agentPending.length > 0) throw new Error("candidates should be processed");
  rmSync(root, { recursive: true, force: true });
});

assert("E2E: Demotion on low success rate", async () => {
  const root = makeRoot();
  const profile = generateAgentV2({ roleSlug: "backend-developer", tier: 2, seed: 42, playbooksDir: pbDir });
  profile.stats = { success_rate: 0.4, projects_completed: 5, utilization_units: 0 };
  const saved = saveAgent(root, profile);

  createLearningCandidate(root, {
    agentId: saved.agent_id,
    taskType: "build",
    trigger: "gate_failure",
    failureSignals: ["compile_error"],
    resolutionSummary: "Fixed syntax",
  });

  const result = await trainAgent(root, saved.agent_id, { playbooksDir: pbDir });
  if (result.tierChange.action !== "demote") throw new Error(`expected demote, got ${result.tierChange.action}`);

  const updated = loadAgent(root, saved.agent_id);
  if (updated.tier !== 1) throw new Error(`tier should be 1, got ${updated.tier}`);
  rmSync(root, { recursive: true, force: true });
});

assert("E2E: playbook:list via CLI shows all 7 hand-written playbooks", () => {
  const root = makeRoot();
  const out = runCli(root, ["agents", "playbook:list"]);
  if (!out.includes("qa-engineer")) throw new Error("missing qa-engineer");
  if (!out.includes("product-manager")) throw new Error("missing product-manager");
  if (!out.includes("backend-architect")) throw new Error("missing backend-architect");
  rmSync(root, { recursive: true, force: true });
});

assert("E2E: All 7 playbooks parse without error", () => {
  // parsePlaybook imported at top level
  const roles = ["product/product-manager.md", "architecture/backend-architect.md", "engineering/frontend-developer.md",
    "quality/qa-engineer.md", "security/security-architect.md", "devops/devops-engineer.md", "expert/scale-performance.md"];
  for (const r of roles) {
    const content = readFileSync(join(pbDir, r), "utf-8");
    const pb = parsePlaybook(content);
    if (!pb.frontmatter.role) throw new Error(`${r}: missing role`);
    if (pb.skills.length === 0) throw new Error(`${r}: no skills`);
  }
});

await Promise.all(pending);
console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
