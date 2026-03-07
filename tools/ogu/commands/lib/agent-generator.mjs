/**
 * agent-generator.mjs — Slice 369 + Slice 385 (V2)
 * Generates marketplace agent profiles deterministically from seed.
 * Pure generator — no file I/O. Storage handled by agent-store.mjs.
 *
 * V1: generateAgent() — original, unchanged
 * V2: generateAgentV2() — playbook-based with 4-layer prompt assembly
 */

import { getRoleConfig } from "./role-taxonomy.mjs";
import { loadPlaybookForRole } from "./playbook-loader.mjs";
import { loadSpecialty } from "./specialty-loader.mjs";
import { assembleSystemPrompt } from "./prompt-assembler.mjs";
import { resolveSkills, defaultSkillsDir } from "./skill-loader.mjs";
import { join } from "node:path";

export const FIRST_NAMES = [
  "Alex","Blake","Casey","Dana","Drew","Ellis","Finn","Gray","Harper","Indigo",
  "Jordan","Kendall","Lane","Morgan","Nova","Oakley","Parker","Quinn","Reese","Sage",
  "Taylor","Uma","Vale","Winter","Xen","Yael","Zara","Ari","Bex","Cal",
  "Dev","Ember","Faye","Glen","Hana","Ira","Jules","Kai","Lior","Mika",
  "Nash","Orion","Pax","Ren","Sloane","Teal","Uri","Vex","Wren","Zion",
];

export const LAST_NAMES = [
  "Ashford","Blake","Chen","Darcy","Ellis","Frost","Gale","Hart","Ives","Jarvis",
  "Kane","Lark","Mercer","Nash","Odell","Patel","Quinn","Reed","Stone","Thorne",
  "Upton","Vance","Ward","Xavier","York","Zhang","Adler","Beck","Cross","Drake",
  "Eaton","Flynn","Grant","Hayes","Irving","Jensen","Klein","Lowe","Moore","Noble",
  "Owen","Park","Reid","Shaw","Tate","Uhl","Vale","West","Yuen","Zane",
];

export const ROLE_CORE_SKILLS = {
  PM:         ["product-strategy","roadmap-planning","stakeholder-management","requirements-analysis","sprint-planning"],
  Architect:  ["system-design","api-design","scalability-planning","tech-debt-analysis","pattern-selection"],
  Engineer:   ["code-implementation","debugging","code-review","testing","refactoring"],
  QA:         ["test-planning","regression-testing","bug-triage","automation-scripting","quality-gates"],
  DevOps:     ["ci-cd","infrastructure-as-code","monitoring","deployment","containerization"],
  Security:   ["threat-modeling","vulnerability-assessment","code-audit","compliance","pen-testing"],
  Doc:        ["technical-writing","api-documentation","user-guides","changelog-management","knowledge-base"],
};

export const SPECIALTY_SKILLS = {
  "frontend":        ["react","css-systems","accessibility","performance-web","component-design"],
  "backend":         ["node","databases","rest-apis","grpc","microservices"],
  "mobile":          ["react-native","ios","android","offline-first","push-notifications"],
  "data":            ["sql","etl","data-pipelines","analytics","ml-ops"],
  "platform":        ["kubernetes","terraform","cloud-native","service-mesh","observability"],
  "security-audit":  ["owasp","sast","dast","zero-trust","secrets-management"],
  "ai-ml":           ["llm-integration","embeddings","fine-tuning","rag","prompt-engineering"],
  "product":         ["user-research","a-b-testing","metrics","growth","funnel-optimization"],
  "docs-api":        ["openapi","postman","swagger","changelog","devrel"],
  "distributed":     ["consensus","eventual-consistency","crdts","event-sourcing","saga-pattern"],
};

export const DNA_STRENGTH_SKILLS = {
  "analytical":   ["root-cause-analysis","metrics-driven","data-interpretation"],
  "creative":     ["innovative-design","unconventional-solutions","prototyping"],
  "systematic":   ["process-improvement","documentation","checklists"],
  "collaborative":["cross-team-alignment","async-communication","knowledge-sharing"],
  "decisive":     ["risk-assessment","fast-decision","trade-off-analysis"],
  "meticulous":   ["edge-case-coverage","thorough-review","zero-defect-mindset"],
};

export const DNA_PROFILES = {
  work_style:         ["async-first","sync-preferred","deep-work","sprint-burst","always-on"],
  communication_style:["concise","verbose","visual","data-driven","narrative"],
  risk_appetite:      ["conservative","balanced","aggressive","experimental","context-dependent"],
  strength_bias:      ["analytical","creative","systematic","collaborative","decisive","meticulous"],
  tooling_bias:       ["cli","gui","automation","manual","hybrid"],
  failure_strategy:   ["retry","escalate","rollback","checkpoint","failfast"],
};

const CAPACITY_BY_ROLE = { PM:6, Architect:8, Engineer:10, QA:8, DevOps:8, Security:8, Doc:6 };
const TIER_BASE_PRICE =  { 1:1.5, 2:4, 3:8, 4:16 };

function seededRand(seed) {
  // Simple LCG for determinism
  let s = (typeof seed === "number" ? seed : hashStr(String(seed))) >>> 0;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xFFFFFFFF;
  };
}

function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pickFrom(arr, rand) {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * generateAgent({ role, specialty, tier, seed? }) → AgentProfile
 */
export function generateAgent({ role, specialty, tier, seed }) {
  const rand = seededRand(seed ?? `${role}-${specialty}-${tier}-${Date.now()}`);

  // 1. Name
  const firstName = pickFrom(FIRST_NAMES, rand);
  const lastName  = pickFrom(LAST_NAMES, rand);
  const name = `${firstName} ${lastName}`;

  // 2. DNA profile
  const dna = {};
  for (const [field, options] of Object.entries(DNA_PROFILES)) {
    dna[field] = pickFrom(options, rand);
  }

  // 3. Skills: core(role) + specialty + DNA strength
  const coreSkills      = ROLE_CORE_SKILLS[role] || [];
  const specialtySkills = SPECIALTY_SKILLS[specialty] || [];
  const strengthKey     = dna.strength_bias;
  const strengthSkills  = Array.isArray(DNA_STRENGTH_SKILLS[strengthKey])
    ? DNA_STRENGTH_SKILLS[strengthKey]
    : [];

  const allSkills = [...new Set([...coreSkills, ...specialtySkills, ...strengthSkills])];

  // 4. System prompt — 6 required sections
  const systemPrompt = buildSystemPrompt({ name, role, specialty, tier, dna, skills: allSkills });

  // 5. Capacity
  const capacityUnits = CAPACITY_BY_ROLE[role] ?? 8;

  // 6. Base price
  const basePrice = TIER_BASE_PRICE[tier] ?? tier * 2;

  const agentId = null; // assigned by agent-store.mjs

  return {
    agent_id: agentId,
    name,
    role,
    specialty,
    tier: Number(tier),
    dna,
    skills: allSkills,
    system_prompt: systemPrompt,
    capacity_units: capacityUnits,
    base_price: basePrice,
    performance_multiplier: 1.0,
    stats: {
      success_rate: 0.8,
      projects_completed: 0,
      utilization_units: 0,
    },
    created_at: new Date().toISOString(),
    status: "available",
  };
}

function buildSystemPrompt({ name, role, specialty, tier, dna, skills, skillDefs }) {
  const skillsSection = Array.isArray(skillDefs) && skillDefs.length > 0
    ? skillDefs.slice(0, 8).map(s => `**${s.name}**: ${s.description}`).join("\n")
    : skills.slice(0, 5).join(", ");

  return [
    `## Identity\nYou are ${name}, a Tier ${tier} ${role} specializing in ${specialty}.\nYour DNA: work style=${dna.work_style}, communication=${dna.communication_style}, risk=${dna.risk_appetite}, strength=${dna.strength_bias}, tooling=${dna.tooling_bias}, failure_strategy=${dna.failure_strategy}.`,
    `## Mission\nDeliver high-quality ${role} outcomes for any project you are hired into. Apply your ${specialty} specialty to maximize value.`,
    `## Constraints\nOperate within your capacity (${CAPACITY_BY_ROLE[role] ?? 8} units). Respect project governance policies. Do not exceed your role boundaries.`,
    `## Skill Definitions\n${skillsSection}`,
    `## Operating Procedure\n1. Read all context before acting.\n2. Apply skills listed above based on task requirements.\n3. Use ${dna.tooling_bias} tooling preference.\n4. Follow ${dna.work_style} work rhythm.\n5. On failure: ${dna.failure_strategy}.`,
    `## Quality Bar\nAll deliverables must pass the project's quality gates. Tier ${tier} agents are expected to produce ${tier >= 3 ? "production-ready" : "review-ready"} output with minimal iteration.`,
    `## Escalation Rules\nEscalate when: (1) requirements are unclear after 2 clarification attempts, (2) a governance policy blocks progress, (3) capacity is exceeded. Use ${dna.communication_style} communication style in all escalations.`,
  ].join("\n\n");
}

// ─── V2 Generator (Slice 385) ───

/**
 * Default playbooks directory path relative to the ogu tools folder.
 */
function defaultPlaybooksDir() {
  const thisFile = new URL(import.meta.url).pathname;
  return join(thisFile, "..", "..", "playbooks");
}

/**
 * generateAgentV2({ roleSlug, specialtySlug, tier, seed, playbooksDir? }) → AgentProfile (V2)
 *
 * V2 flow:
 * 1. Look up role in ROLE_TAXONOMY
 * 2. Load base playbook
 * 3. Load specialty addendum
 * 4. Generate DNA (same seeded random)
 * 5. Generate name (same as V1)
 * 6. Extract skills from playbook + specialty (not hardcoded)
 * 7. Assemble 4-layer prompt
 * 8. Return V2 profile with prompt_version, experience_digest, role_history
 *
 * Falls back to basic V1-style template when playbook not found.
 */
export function generateAgentV2({ roleSlug, specialtySlug, tier, seed, playbooksDir, skillsDir }) {
  const pbDir = playbooksDir || defaultPlaybooksDir();
  const skDir = skillsDir || defaultSkillsDir();
  const specialtiesDir = join(pbDir, "specialties");
  const rand = seededRand(seed ?? `${roleSlug}-${specialtySlug}-${tier}-${Date.now()}`);

  // 1. Role config from taxonomy
  const roleConfig = getRoleConfig(roleSlug);
  const displayName = roleConfig?.displayName || roleSlug;
  const category = roleConfig?.category || "engineering";
  const capacityUnits = roleConfig?.capacityUnits ?? 8;

  // 2. Name (same mechanism as V1)
  const firstName = pickFrom(FIRST_NAMES, rand);
  const lastName  = pickFrom(LAST_NAMES, rand);
  const name = `${firstName} ${lastName}`;

  // 3. DNA profile (same mechanism as V1)
  const dna = {};
  for (const [field, options] of Object.entries(DNA_PROFILES)) {
    dna[field] = pickFrom(options, rand);
  }

  // 4. Load playbook
  let playbook = null;
  try { playbook = loadPlaybookForRole(pbDir, roleSlug); } catch { /* fallback */ }

  // 5. Load specialty
  let specialty = null;
  if (specialtySlug) {
    try { specialty = loadSpecialty(specialtiesDir, specialtySlug); } catch { /* skip */ }
  }

  // 6. Skills: from playbook + specialty (not hardcoded)
  let skills = [];
  if (playbook) {
    skills = [...(playbook.skills || [])];
  }
  if (specialty) {
    skills = [...new Set([...skills, ...(specialty.skills || [])])];
  }
  // Add DNA strength skills as fallback enrichment
  const strengthSkills = DNA_STRENGTH_SKILLS[dna.strength_bias] || [];
  skills = [...new Set([...skills, ...strengthSkills])];

  // If no playbook found, fall back to V1-style skills
  if (skills.length === 0) {
    const roleKey = Object.keys(ROLE_CORE_SKILLS).find(k => k.toLowerCase() === roleSlug.split("-")[0]);
    const coreSkills = ROLE_CORE_SKILLS[roleKey] || [];
    const specSkills = SPECIALTY_SKILLS[specialtySlug] || [];
    skills = [...new Set([...coreSkills, ...specSkills, ...strengthSkills])];
  }

  // 7. Resolve skills to { name, description } objects (Claude Skills format)
  const skillDefs = resolveSkills(skDir, skills);

  // 8. Assemble 5-layer prompt
  let systemPrompt;
  if (playbook) {
    systemPrompt = assembleSystemPrompt({
      playbook,
      specialty,
      skills: skillDefs,
      dna,
      experience: "", // Empty for new agents
    });
  } else {
    // Fallback to V1-style template with skill descriptions
    systemPrompt = buildSystemPrompt({ name, role: displayName, specialty: specialtySlug || "general", tier, dna, skills, skillDefs });
  }

  // 8. Pricing
  const tierNum = Number(tier);
  const basePrice = TIER_BASE_PRICE[tierNum] ?? tierNum * 2;

  const now = new Date().toISOString();

  return {
    agent_id: null, // assigned by agent-store
    name,
    role: roleSlug,
    role_display: displayName,
    category,
    specialty: specialtySlug || null,
    tier: tierNum,
    dna,
    skills,
    skill_definitions: skillDefs,
    system_prompt: systemPrompt,
    capacity_units: capacityUnits,
    base_price: basePrice,
    performance_multiplier: 1.0,
    stats: {
      success_rate: 0.8,
      projects_completed: 0,
      utilization_units: 0,
    },
    created_at: now,
    status: "available",
    // V2 fields
    prompt_version: 1,
    experience_digest: "",
    experience_sources_count: 0,
    role_history: [{ role: roleSlug, tier: tierNum, from: now, to: null }],
    last_prompt_update: now,
    last_learning_event_id: null,
    profile_version: 2,
  };
}
