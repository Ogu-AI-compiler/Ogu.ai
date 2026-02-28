/**
 * Slice 102 — Agent State Persistence + OrgSpec Seeder
 *
 * Agent state persistence: save/load per-agent state to disk.
 * OrgSpec seeder: generate full 10-role OrgSpec with modelPolicy/budgetQuota.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 102 — Agent State Persistence + OrgSpec Seeder\x1b[0m\n");

// ── Part 1: Agent State Persistence ──────────────────────────────

console.log("\x1b[36m  Part 1: Agent State Persistence\x1b[0m");

const aspLib = join(process.cwd(), "tools/ogu/commands/lib/agent-state-persistence.mjs");
assert("agent-state-persistence.mjs exists", () => {
  if (!existsSync(aspLib)) throw new Error("file missing");
});

const aspMod = await import(aspLib);

assert("createAgentStatePersistence returns persistence manager", () => {
  if (typeof aspMod.createAgentStatePersistence !== "function") throw new Error("missing");
  const asp = aspMod.createAgentStatePersistence({ dir: "/tmp/ogu-test-asp-" + Date.now() });
  if (typeof asp.save !== "function") throw new Error("missing save");
  if (typeof asp.load !== "function") throw new Error("missing load");
  if (typeof asp.update !== "function") throw new Error("missing update");
});

assert("save and load round-trip agent state", async () => {
  const dir = "/tmp/ogu-test-asp-" + Date.now();
  const asp = aspMod.createAgentStatePersistence({ dir });
  const state = {
    roleId: "backend-dev",
    tokensUsedToday: 5000,
    tasksCompleted: 3,
    tasksFailed: 1,
    escalations: 0,
    lastActive: "2026-02-28T10:00:00Z",
  };
  await asp.save("backend-dev", state);
  const loaded = await asp.load("backend-dev");
  if (loaded.tokensUsedToday !== 5000) throw new Error(`expected 5000, got ${loaded.tokensUsedToday}`);
  if (loaded.tasksCompleted !== 3) throw new Error(`expected 3, got ${loaded.tasksCompleted}`);
});

assert("load returns defaults for missing agent", async () => {
  const dir = "/tmp/ogu-test-asp-defaults-" + Date.now();
  const asp = aspMod.createAgentStatePersistence({ dir });
  const loaded = await asp.load("nonexistent");
  if (loaded.tokensUsedToday !== 0) throw new Error(`expected 0, got ${loaded.tokensUsedToday}`);
  if (loaded.tasksCompleted !== 0) throw new Error(`expected 0, got ${loaded.tasksCompleted}`);
});

assert("update merges partial state", async () => {
  const dir = "/tmp/ogu-test-asp-update-" + Date.now();
  const asp = aspMod.createAgentStatePersistence({ dir });
  await asp.save("qa", { roleId: "qa", tokensUsedToday: 100, tasksCompleted: 1, tasksFailed: 0, escalations: 0 });
  await asp.update("qa", { tokensUsedToday: 200, tasksCompleted: 2 });
  const loaded = await asp.load("qa");
  if (loaded.tokensUsedToday !== 200) throw new Error(`expected 200, got ${loaded.tokensUsedToday}`);
  if (loaded.tasksCompleted !== 2) throw new Error(`expected 2, got ${loaded.tasksCompleted}`);
});

assert("listAgents returns all saved agents", async () => {
  const dir = "/tmp/ogu-test-asp-list-" + Date.now();
  const asp = aspMod.createAgentStatePersistence({ dir });
  await asp.save("a", { roleId: "a", tokensUsedToday: 0, tasksCompleted: 0, tasksFailed: 0, escalations: 0 });
  await asp.save("b", { roleId: "b", tokensUsedToday: 0, tasksCompleted: 0, tasksFailed: 0, escalations: 0 });
  const agents = await asp.listAgents();
  if (agents.length !== 2) throw new Error(`expected 2, got ${agents.length}`);
});

// ── Part 2: OrgSpec Seeder ──────────────────────────────

console.log("\n\x1b[36m  Part 2: OrgSpec Seeder\x1b[0m");

const osLib = join(process.cwd(), "tools/ogu/commands/lib/orgspec-seeder.mjs");
assert("orgspec-seeder.mjs exists", () => {
  if (!existsSync(osLib)) throw new Error("file missing");
});

const osMod = await import(osLib);

assert("seedOrgSpec returns full 10-role spec", () => {
  if (typeof osMod.seedOrgSpec !== "function") throw new Error("missing");
  const spec = osMod.seedOrgSpec();
  if (!spec.roles || !Array.isArray(spec.roles)) throw new Error("missing roles array");
  if (spec.roles.length !== 10) throw new Error(`expected 10 roles, got ${spec.roles.length}`);
});

assert("each role has required fields", () => {
  const spec = osMod.seedOrgSpec();
  const required = ["id", "label", "capabilities", "modelPolicy", "budgetQuota", "escalationPath", "memoryScope", "phases"];
  for (const role of spec.roles) {
    for (const field of required) {
      if (role[field] === undefined) throw new Error(`role ${role.id} missing ${field}`);
    }
  }
});

assert("modelPolicy has escalationChain", () => {
  const spec = osMod.seedOrgSpec();
  for (const role of spec.roles) {
    if (!role.modelPolicy.escalationChain || !Array.isArray(role.modelPolicy.escalationChain)) {
      throw new Error(`role ${role.id} missing escalationChain`);
    }
    if (role.modelPolicy.escalationChain.length === 0) {
      throw new Error(`role ${role.id} has empty escalationChain`);
    }
  }
});

assert("budgetQuota has dailyTokens", () => {
  const spec = osMod.seedOrgSpec();
  for (const role of spec.roles) {
    if (typeof role.budgetQuota.dailyTokens !== "number") {
      throw new Error(`role ${role.id} missing dailyTokens`);
    }
    if (role.budgetQuota.dailyTokens <= 0) {
      throw new Error(`role ${role.id} has invalid dailyTokens`);
    }
  }
});

assert("DEFAULT_ROLES constant has correct role IDs", () => {
  if (!Array.isArray(osMod.DEFAULT_ROLES)) throw new Error("missing DEFAULT_ROLES");
  const expected = ["pm", "architect", "designer", "backend-dev", "frontend-dev", "qa", "security", "devops", "tech-lead", "cto"];
  for (const r of expected) {
    if (!osMod.DEFAULT_ROLES.includes(r)) throw new Error(`missing role ${r}`);
  }
});

console.log(`\n\x1b[1m  Results: ${pass} passed, ${fail} failed\x1b[0m\n`);
process.exit(fail > 0 ? 1 : 0);
