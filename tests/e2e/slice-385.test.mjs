/**
 * Slice 385 — Agent Generator V2
 */

import { generateAgent, generateAgentV2 } from "../../tools/ogu/commands/lib/agent-generator.mjs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 385 — Agent Generator V2\x1b[0m\n");

const thisFile = fileURLToPath(import.meta.url);
const pbDir = join(thisFile, "..", "..", "..", "tools", "ogu", "playbooks");

assert("V1 generateAgent still works unchanged", () => {
  const agent = generateAgent({ role: "Engineer", specialty: "backend", tier: 2, seed: 42 });
  if (!agent.name) throw new Error("missing name");
  if (agent.role !== "Engineer") throw new Error("wrong role");
  if (agent.tier !== 2) throw new Error("wrong tier");
  if (!agent.system_prompt.includes("Identity")) throw new Error("missing system prompt");
});

assert("V1 generateAgent is deterministic", () => {
  const a1 = generateAgent({ role: "QA", specialty: "frontend", tier: 1, seed: 99 });
  const a2 = generateAgent({ role: "QA", specialty: "frontend", tier: 1, seed: 99 });
  if (a1.name !== a2.name) throw new Error("not deterministic");
  if (a1.skills.join(",") !== a2.skills.join(",")) throw new Error("skills not deterministic");
});

assert("generateAgentV2 returns V2 shape", () => {
  const agent = generateAgentV2({ roleSlug: "qa-engineer", specialtySlug: "react", tier: 2, seed: 42, playbooksDir: pbDir });
  if (!agent.name) throw new Error("missing name");
  if (agent.role !== "qa-engineer") throw new Error(`wrong role: ${agent.role}`);
  if (agent.tier !== 2) throw new Error("wrong tier");
  if (agent.profile_version !== 2) throw new Error(`wrong profile_version: ${agent.profile_version}`);
  if (agent.prompt_version !== 1) throw new Error(`wrong prompt_version: ${agent.prompt_version}`);
  if (!Array.isArray(agent.role_history)) throw new Error("missing role_history");
});

assert("V2 has experience fields with defaults", () => {
  const agent = generateAgentV2({ roleSlug: "product-manager", tier: 1, seed: 42, playbooksDir: pbDir });
  if (agent.experience_digest !== "") throw new Error("experience_digest should be empty");
  if (agent.experience_sources_count !== 0) throw new Error("sources should be 0");
  if (agent.last_learning_event_id !== null) throw new Error("last event id should be null");
});

assert("V2 role_history has initial entry", () => {
  const agent = generateAgentV2({ roleSlug: "backend-architect", tier: 2, seed: 42, playbooksDir: pbDir });
  if (agent.role_history.length !== 1) throw new Error(`got ${agent.role_history.length} entries`);
  if (agent.role_history[0].role !== "backend-architect") throw new Error("wrong role in history");
  if (agent.role_history[0].tier !== 2) throw new Error("wrong tier in history");
  if (agent.role_history[0].to !== null) throw new Error("to should be null");
});

assert("V2 extracts skills from playbook", () => {
  const agent = generateAgentV2({ roleSlug: "qa-engineer", specialtySlug: "react", tier: 1, seed: 42, playbooksDir: pbDir });
  // Playbook skills should include some from the QA playbook
  if (agent.skills.length < 5) throw new Error(`only ${agent.skills.length} skills`);
});

assert("V2 skills include specialty skills", () => {
  const agent = generateAgentV2({ roleSlug: "frontend-developer", specialtySlug: "react", tier: 1, seed: 42, playbooksDir: pbDir });
  if (!agent.skills.includes("react")) throw new Error("missing react from specialty");
});

assert("V2 system prompt is longer than V1 (uses playbook)", () => {
  const v1 = generateAgent({ role: "Engineer", specialty: "backend", tier: 2, seed: 42 });
  const v2 = generateAgentV2({ roleSlug: "frontend-developer", specialtySlug: "node", tier: 2, seed: 42, playbooksDir: pbDir });
  if (v2.system_prompt.length <= v1.system_prompt.length) throw new Error("V2 prompt should be longer than V1");
});

assert("V2 has role_display field", () => {
  const agent = generateAgentV2({ roleSlug: "security-architect", tier: 2, seed: 42, playbooksDir: pbDir });
  if (!agent.role_display) throw new Error("missing role_display");
  if (agent.role_display !== "Security Architect") throw new Error(`got ${agent.role_display}`);
});

assert("V2 has category field", () => {
  const agent = generateAgentV2({ roleSlug: "devops-engineer", tier: 1, seed: 42, playbooksDir: pbDir });
  if (agent.category !== "devops") throw new Error(`got ${agent.category}`);
});

assert("V2 is deterministic with same seed", () => {
  const a1 = generateAgentV2({ roleSlug: "qa-engineer", specialtySlug: "node", tier: 2, seed: 123, playbooksDir: pbDir });
  const a2 = generateAgentV2({ roleSlug: "qa-engineer", specialtySlug: "node", tier: 2, seed: 123, playbooksDir: pbDir });
  if (a1.name !== a2.name) throw new Error("not deterministic");
});

assert("V2 handles null specialty", () => {
  const agent = generateAgentV2({ roleSlug: "product-manager", specialtySlug: null, tier: 1, seed: 42, playbooksDir: pbDir });
  if (!agent.name) throw new Error("missing name");
  if (agent.specialty !== null) throw new Error("specialty should be null");
});

assert("V2 falls back gracefully for unknown role", () => {
  const agent = generateAgentV2({ roleSlug: "completely-unknown-role", specialtySlug: null, tier: 1, seed: 42, playbooksDir: pbDir });
  if (!agent.name) throw new Error("missing name");
  if (!agent.system_prompt) throw new Error("missing prompt");
});

assert("V2 base_price matches tier", () => {
  const t1 = generateAgentV2({ roleSlug: "qa-engineer", tier: 1, seed: 42, playbooksDir: pbDir });
  const t3 = generateAgentV2({ roleSlug: "qa-engineer", tier: 3, seed: 42, playbooksDir: pbDir });
  if (t1.base_price !== 1.5) throw new Error(`tier 1 price: ${t1.base_price}`);
  if (t3.base_price !== 8) throw new Error(`tier 3 price: ${t3.base_price}`);
});

assert("V2 includes DNA strength skills", () => {
  const agent = generateAgentV2({ roleSlug: "product-manager", tier: 1, seed: 42, playbooksDir: pbDir });
  // Should have some DNA skills
  if (agent.skills.length < 3) throw new Error("too few skills");
});

assert("V2 has created_at timestamp", () => {
  const agent = generateAgentV2({ roleSlug: "qa-engineer", tier: 1, seed: 42, playbooksDir: pbDir });
  if (!agent.created_at) throw new Error("missing created_at");
  // Should be valid ISO date
  if (isNaN(Date.parse(agent.created_at))) throw new Error("invalid date");
});

assert("V2 status is available", () => {
  const agent = generateAgentV2({ roleSlug: "devops-engineer", tier: 2, seed: 42, playbooksDir: pbDir });
  if (agent.status !== "available") throw new Error(`got ${agent.status}`);
});

assert("V2 agent_id is null (store assigns)", () => {
  const agent = generateAgentV2({ roleSlug: "qa-engineer", tier: 1, seed: 42, playbooksDir: pbDir });
  if (agent.agent_id !== null) throw new Error("agent_id should be null");
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
