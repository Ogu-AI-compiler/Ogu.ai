/**
 * Slice 389 — Agent Store V2
 */

import { saveAgent, loadAgent, listAgents, appendRoleHistory, updateExperience, bumpPromptVersion } from "../../tools/ogu/commands/lib/agent-store.mjs";
import { generateAgent } from "../../tools/ogu/commands/lib/agent-generator.mjs";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 389 — Agent Store V2\x1b[0m\n");

function makeRoot() {
  const root = join(tmpdir(), `ogu-389-${randomUUID().slice(0,8)}`);
  mkdirSync(join(root, ".ogu/marketplace/agents"), { recursive: true });
  return root;
}

assert("loadAgent auto-migrates V1 profile to V2", () => {
  const root = makeRoot();
  const v1 = generateAgent({ role: "QA", specialty: "frontend", tier: 1, seed: 42 });
  const saved = saveAgent(root, v1);

  // Write a raw V1 profile (without profile_version)
  const filePath = join(root, ".ogu/marketplace/agents", `${saved.agent_id}.json`);
  const rawV1 = JSON.parse(readFileSync(filePath, "utf-8"));
  delete rawV1.profile_version; // ensure it's V1
  writeFileSync(filePath, JSON.stringify(rawV1, null, 2) + "\n", "utf-8");

  // Load triggers auto-migration
  const loaded = loadAgent(root, saved.agent_id);
  if (loaded.profile_version !== 2) throw new Error(`expected V2, got ${loaded.profile_version}`);
  if (!Array.isArray(loaded.role_history)) throw new Error("missing role_history");
  rmSync(root, { recursive: true, force: true });
});

assert("loadAgent returns V2 profile unchanged", () => {
  const root = makeRoot();
  const v2 = {
    agent_id: null,
    name: "Test Agent",
    role: "qa-engineer",
    tier: 2,
    profile_version: 2,
    prompt_version: 5,
    experience_digest: "some rules",
    role_history: [{ role: "qa-engineer", tier: 2, from: "2026-01-01", to: null }],
  };
  const saved = saveAgent(root, v2);
  const loaded = loadAgent(root, saved.agent_id);
  if (loaded.prompt_version !== 5) throw new Error("overwrote prompt_version");
  if (loaded.experience_digest !== "some rules") throw new Error("overwrote digest");
  rmSync(root, { recursive: true, force: true });
});

assert("appendRoleHistory closes previous entry and adds new", () => {
  const root = makeRoot();
  const profile = {
    agent_id: null,
    name: "Test",
    role: "qa-engineer",
    tier: 1,
    profile_version: 2,
    role_history: [{ role: "qa-engineer", tier: 1, from: "2026-01-01", to: null }],
  };
  const saved = saveAgent(root, profile);

  const updated = appendRoleHistory(root, saved.agent_id, { role: "backend-architect", tier: 2 });
  if (updated.role_history.length !== 2) throw new Error(`got ${updated.role_history.length}`);
  if (updated.role_history[0].to === null) throw new Error("first entry should be closed");
  if (updated.role_history[1].role !== "backend-architect") throw new Error("wrong new role");
  if (updated.role_history[1].to !== null) throw new Error("new entry should be open");
  rmSync(root, { recursive: true, force: true });
});

assert("appendRoleHistory handles empty role_history", () => {
  const root = makeRoot();
  const profile = {
    agent_id: null,
    name: "Test",
    role: "qa",
    tier: 1,
    profile_version: 2,
    role_history: [],
  };
  const saved = saveAgent(root, profile);
  const updated = appendRoleHistory(root, saved.agent_id, { role: "devops", tier: 2 });
  if (updated.role_history.length !== 1) throw new Error("should have 1 entry");
  rmSync(root, { recursive: true, force: true });
});

assert("appendRoleHistory throws for unknown agent", () => {
  const root = makeRoot();
  let threw = false;
  try { appendRoleHistory(root, "agent_9999", { role: "x", tier: 1 }); }
  catch { threw = true; }
  if (!threw) throw new Error("should throw");
  rmSync(root, { recursive: true, force: true });
});

assert("updateExperience updates digest and sources count", () => {
  const root = makeRoot();
  const profile = {
    agent_id: null,
    name: "Test",
    role: "qa",
    tier: 1,
    profile_version: 2,
    experience_digest: "",
    experience_sources_count: 0,
  };
  const saved = saveAgent(root, profile);

  const updated = updateExperience(root, saved.agent_id, {
    digest: "Rule 1\nRule 2",
    sourcesCount: 5,
    learningEventId: "evt-001",
  });

  if (updated.experience_digest !== "Rule 1\nRule 2") throw new Error("wrong digest");
  if (updated.experience_sources_count !== 5) throw new Error("wrong count");
  if (updated.last_learning_event_id !== "evt-001") throw new Error("wrong event id");
  rmSync(root, { recursive: true, force: true });
});

assert("updateExperience only updates provided fields", () => {
  const root = makeRoot();
  const profile = {
    agent_id: null,
    name: "Test",
    role: "qa",
    tier: 1,
    profile_version: 2,
    experience_digest: "old rules",
    experience_sources_count: 3,
    last_learning_event_id: "old-evt",
  };
  const saved = saveAgent(root, profile);

  // Only update digest
  const updated = updateExperience(root, saved.agent_id, { digest: "new rules" });
  if (updated.experience_digest !== "new rules") throw new Error("wrong digest");
  if (updated.experience_sources_count !== 3) throw new Error("overwrote sources count");
  rmSync(root, { recursive: true, force: true });
});

assert("bumpPromptVersion increments version", () => {
  const root = makeRoot();
  const profile = {
    agent_id: null,
    name: "Test",
    role: "qa",
    tier: 1,
    profile_version: 2,
    prompt_version: 3,
  };
  const saved = saveAgent(root, profile);
  const updated = bumpPromptVersion(root, saved.agent_id);
  if (updated.prompt_version !== 4) throw new Error(`got ${updated.prompt_version}`);
  if (!updated.last_prompt_update) throw new Error("missing last_prompt_update");
  rmSync(root, { recursive: true, force: true });
});

assert("bumpPromptVersion handles missing prompt_version", () => {
  const root = makeRoot();
  const profile = {
    agent_id: null,
    name: "Test",
    role: "qa",
    tier: 1,
    profile_version: 2,
  };
  const saved = saveAgent(root, profile);
  const updated = bumpPromptVersion(root, saved.agent_id);
  if (updated.prompt_version !== 1) throw new Error(`got ${updated.prompt_version}`);
  rmSync(root, { recursive: true, force: true });
});

assert("bumpPromptVersion throws for unknown agent", () => {
  const root = makeRoot();
  let threw = false;
  try { bumpPromptVersion(root, "agent_9999"); }
  catch { threw = true; }
  if (!threw) throw new Error("should throw");
  rmSync(root, { recursive: true, force: true });
});

assert("V1 listAgents still works", () => {
  const root = makeRoot();
  const v1 = generateAgent({ role: "QA", specialty: "frontend", tier: 1, seed: 42 });
  saveAgent(root, v1);
  const agents = listAgents(root);
  if (agents.length !== 1) throw new Error(`got ${agents.length}`);
  rmSync(root, { recursive: true, force: true });
});

assert("V1 and V2 agents coexist in index", () => {
  const root = makeRoot();
  const v1 = generateAgent({ role: "QA", specialty: "frontend", tier: 1, seed: 42 });
  saveAgent(root, v1);
  const v2 = {
    agent_id: null,
    name: "V2 Agent",
    role: "qa-engineer",
    tier: 2,
    profile_version: 2,
    status: "available",
    capacity_units: 8,
    base_price: 4,
  };
  saveAgent(root, v2);
  const agents = listAgents(root);
  if (agents.length !== 2) throw new Error(`got ${agents.length}`);
  rmSync(root, { recursive: true, force: true });
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
