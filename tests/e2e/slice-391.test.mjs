/**
 * Slice 391 — Role Evolution & Experience Generalization
 */

import { generalizeExperience, evaluateRoleChange, archiveExperience, applyRoleChange } from "../../tools/ogu/commands/lib/role-evolution.mjs";
import { saveAgent, loadAgent } from "../../tools/ogu/commands/lib/agent-store.mjs";
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
function assert(label, fn) {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗\x1b[0m ${label}: ${e.message}`); }
}

console.log("\n\x1b[1mSlice 391 — Role Evolution & Experience Generalization\x1b[0m\n");

const thisFile = fileURLToPath(import.meta.url);
const pbDir = join(thisFile, "..", "..", "..", "tools", "ogu", "playbooks");

function makeRoot() {
  const root = join(tmpdir(), `ogu-391-${randomUUID().slice(0,8)}`);
  mkdirSync(join(root, ".ogu/marketplace/agents"), { recursive: true });
  return root;
}

// ── generalizeExperience ──

assert("generalizeExperience replaces Express with abstract term", () => {
  const digest = "When building: Express middleware should validate auth tokens";
  const result = generalizeExperience(digest, "backend-developer", "frontend-developer");
  if (result.includes("Express middleware")) throw new Error("should generalize Express middleware");
  if (!result.includes("server framework boundaries")) throw new Error(`got: ${result}`);
});

assert("generalizeExperience replaces React with abstract term", () => {
  const digest = "When testing: React hooks must cleanup subscriptions";
  const result = generalizeExperience(digest, "frontend-developer", "backend-developer");
  if (result.includes("React hooks")) throw new Error("should generalize React hooks");
  if (!result.includes("UI framework lifecycle")) throw new Error(`got: ${result}`);
});

assert("generalizeExperience replaces PostgreSQL with abstract", () => {
  const digest = "Always use PostgreSQL indexes for frequently queried columns";
  const result = generalizeExperience(digest, "data-engineer", "backend-architect");
  if (result.includes("PostgreSQL")) throw new Error("should generalize");
  if (!result.includes("relational database")) throw new Error(`got: ${result}`);
});

assert("generalizeExperience replaces Kubernetes with abstract", () => {
  const digest = "Kubernetes pods should always have resource limits";
  const result = generalizeExperience(digest, "devops-engineer", "backend-developer");
  if (result.includes("Kubernetes")) throw new Error("should generalize");
  if (!result.includes("container orchestration")) throw new Error(`got: ${result}`);
});

assert("generalizeExperience handles empty digest", () => {
  const result = generalizeExperience("", "a", "b");
  if (result !== "") throw new Error("should be empty");
});

assert("generalizeExperience handles null digest", () => {
  const result = generalizeExperience(null, "a", "b");
  if (result !== "") throw new Error("should be empty");
});

assert("generalizeExperience preserves non-tech content", () => {
  const digest = "Always validate user input before processing";
  const result = generalizeExperience(digest, "a", "b");
  if (result !== digest) throw new Error("should preserve generic content");
});

// ── evaluateRoleChange ──

assert("evaluateRoleChange returns insufficient data for few patterns", () => {
  const agent = { role: "qa-engineer", tier: 1 };
  const result = evaluateRoleChange(agent, [{ task_type: "build" }]);
  if (result.recommended) throw new Error("should not recommend with < 5 patterns");
});

assert("evaluateRoleChange returns not recommended for aligned patterns", () => {
  const agent = { role: "qa-engineer", tier: 1 };
  const patterns = Array.from({ length: 10 }, () => ({ task_type: "qa-testing" }));
  const result = evaluateRoleChange(agent, patterns);
  if (result.recommended) throw new Error("should not recommend when aligned");
});

assert("evaluateRoleChange returns recommended for misaligned patterns", () => {
  const agent = { role: "qa-engineer", tier: 1 };
  const patterns = Array.from({ length: 10 }, () => ({ task_type: "architecture-design" }));
  const result = evaluateRoleChange(agent, patterns);
  if (!result.recommended) throw new Error("should recommend when misaligned");
});

// ── archiveExperience ──

assert("archiveExperience creates archive file", () => {
  const root = makeRoot();
  archiveExperience(root, "agent_0001", "qa-engineer", "Some old rules");
  const archiveDir = join(root, ".ogu/marketplace/experience-archive");
  if (!existsSync(archiveDir)) throw new Error("archive dir not created");
  const files = readdirSync(archiveDir).filter(f => f.endsWith(".json"));
  if (files.length !== 1) throw new Error(`got ${files.length} files`);
  rmSync(root, { recursive: true, force: true });
});

assert("archiveExperience saves agent_id and role in file", () => {
  const root = makeRoot();
  archiveExperience(root, "agent_0042", "devops-engineer", "My rules");
  const archiveDir = join(root, ".ogu/marketplace/experience-archive");
  const files = readdirSync(archiveDir).filter(f => f.endsWith(".json"));
  const data = JSON.parse(readFileSync(join(archiveDir, files[0]), "utf-8"));
  if (data.agent_id !== "agent_0042") throw new Error("wrong agent_id");
  if (data.role !== "devops-engineer") throw new Error("wrong role");
  if (data.digest !== "My rules") throw new Error("wrong digest");
  rmSync(root, { recursive: true, force: true });
});

// ── applyRoleChange ──

assert("applyRoleChange updates role and category", () => {
  const root = makeRoot();
  const profile = {
    agent_id: null, name: "Test", role: "qa-engineer", role_display: "QA Engineer",
    category: "quality", tier: 2, profile_version: 2,
    experience_digest: "Use React hooks carefully",
    role_history: [{ role: "qa-engineer", tier: 2, from: "2026-01-01", to: null }],
    dna: { work_style: "async-first", communication_style: "concise", risk_appetite: "balanced",
           strength_bias: "analytical", tooling_bias: "cli", failure_strategy: "retry" },
    skills: ["testing"],
    prompt_version: 1,
    system_prompt: "old prompt",
  };
  const saved = saveAgent(root, profile);

  const updated = applyRoleChange(root, saved.agent_id, "backend-architect", pbDir);
  if (updated.role !== "backend-architect") throw new Error(`got role: ${updated.role}`);
  if (updated.role_display !== "Backend Architect") throw new Error(`got display: ${updated.role_display}`);
  if (updated.category !== "architecture") throw new Error(`got category: ${updated.category}`);
  rmSync(root, { recursive: true, force: true });
});

assert("applyRoleChange generalizes experience", () => {
  const root = makeRoot();
  const profile = {
    agent_id: null, name: "Test", role: "frontend-developer",
    tier: 2, profile_version: 2,
    experience_digest: "React components must have proper error boundaries",
    role_history: [{ role: "frontend-developer", tier: 2, from: "2026-01-01", to: null }],
    dna: { work_style: "deep-work", communication_style: "visual", risk_appetite: "balanced",
           strength_bias: "creative", tooling_bias: "gui", failure_strategy: "retry" },
    skills: ["react"], prompt_version: 1, system_prompt: "old",
  };
  const saved = saveAgent(root, profile);
  const updated = applyRoleChange(root, saved.agent_id, "backend-developer", pbDir);
  // React should be generalized
  if (updated.experience_digest.includes("React")) throw new Error("should generalize React");
  rmSync(root, { recursive: true, force: true });
});

assert("applyRoleChange archives raw experience", () => {
  const root = makeRoot();
  const profile = {
    agent_id: null, name: "Test", role: "qa-engineer",
    tier: 1, profile_version: 2,
    experience_digest: "Original rules here",
    role_history: [], dna: {}, skills: [], prompt_version: 0, system_prompt: "x",
  };
  const saved = saveAgent(root, profile);
  applyRoleChange(root, saved.agent_id, "devops-engineer", pbDir);

  const archiveDir = join(root, ".ogu/marketplace/experience-archive");
  if (!existsSync(archiveDir)) throw new Error("archive not created");
  const files = readdirSync(archiveDir);
  if (files.length === 0) throw new Error("no archive file");
  rmSync(root, { recursive: true, force: true });
});

assert("applyRoleChange throws for unknown agent", () => {
  const root = makeRoot();
  let threw = false;
  try { applyRoleChange(root, "agent_9999", "qa-engineer", pbDir); }
  catch { threw = true; }
  if (!threw) throw new Error("should throw");
  rmSync(root, { recursive: true, force: true });
});

console.log("\n" + "═".repeat(50));
console.log(`Results: ${pass} passed, ${fail} failed`);
console.log("═".repeat(50) + "\n");
process.exit(fail > 0 ? 1 : 0);
