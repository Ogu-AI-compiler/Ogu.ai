/**
 * role-evolution.mjs — Slice 391
 * Handles role changes — the most complex trainer operation.
 * Generalizes experience when an agent switches roles,
 * abstracting technology-specific knowledge into architectural principles.
 */

import { existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getRoleConfig } from "./role-taxonomy.mjs";
import { loadAgent, saveAgent, appendRoleHistory } from "./agent-store.mjs";
import { loadPlaybookForRole } from "./playbook-loader.mjs";
import { loadSpecialty } from "./specialty-loader.mjs";
import { assembleSystemPrompt } from "./prompt-assembler.mjs";

/**
 * Deterministic substitution map for experience generalization.
 * Technology-specific terms → architectural abstractions.
 */
const GENERALIZATION_MAP = {
  // Frameworks → abstract concepts
  "Express middleware":       "server framework boundaries",
  "Express":                  "HTTP server framework",
  "Fastify":                  "HTTP server framework",
  "Koa":                      "HTTP server framework",
  "React hooks":              "UI framework lifecycle",
  "React components":         "UI component system",
  "React":                    "UI framework",
  "Vue":                      "UI framework",
  "Svelte":                   "UI framework",
  "Angular":                  "UI framework",
  "Next.js":                  "SSR framework",
  "Nuxt":                     "SSR framework",
  "Redux":                    "state management layer",
  "Zustand":                  "state management layer",
  "MobX":                     "state management layer",
  // Databases → abstract
  "PostgreSQL":               "relational database",
  "MySQL":                    "relational database",
  "MongoDB":                  "document store",
  "Redis":                    "cache/key-value store",
  "DynamoDB":                 "managed NoSQL store",
  "Elasticsearch":            "search engine",
  // Infrastructure → abstract
  "Kubernetes":               "container orchestration",
  "Docker":                   "containerization",
  "Terraform":                "infrastructure-as-code",
  "AWS":                      "cloud provider",
  "GCP":                      "cloud provider",
  "Azure":                    "cloud provider",
  "Lambda":                   "serverless compute",
  "ECS":                      "container service",
  // Languages → abstract
  "TypeScript":               "typed language",
  "JavaScript":               "dynamic language",
  "Python":                   "scripting language",
  "Go":                       "compiled language",
  "Rust":                     "systems language",
  "Java":                     "managed language",
  // Testing → abstract
  "Jest":                     "test runner",
  "Vitest":                   "test runner",
  "Playwright":               "browser automation",
  "Cypress":                  "browser automation",
  "MSW":                      "API mock layer",
  // Protocols → abstract
  "REST":                     "synchronous API",
  "gRPC":                     "RPC protocol",
  "GraphQL":                  "query API",
  "WebSocket":                "bidirectional protocol",
  "Kafka":                    "message broker",
  "RabbitMQ":                 "message broker",
};

/**
 * generalizeExperience(oldDigest, oldRole, newRole) → generalized digest
 * Applies deterministic substitution map to abstract technology-specific rules
 * into architectural principles.
 */
export function generalizeExperience(oldDigest, oldRole, newRole) {
  if (!oldDigest || typeof oldDigest !== "string") return "";

  let generalized = oldDigest;

  // Apply substitutions (longest first to avoid partial matches)
  const sortedKeys = Object.keys(GENERALIZATION_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    generalized = generalized.replace(regex, GENERALIZATION_MAP[key]);
  }

  // Replace role-specific references
  if (oldRole && newRole) {
    const oldConfig = getRoleConfig(oldRole);
    const newConfig = getRoleConfig(newRole);
    if (oldConfig && newConfig) {
      generalized = generalized.replace(
        new RegExp(oldConfig.displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        "previous role"
      );
    }
  }

  return generalized;
}

/**
 * evaluateRoleChange(agent, patterns, taxonomy) → { recommended, newRole, reason }
 *
 * patterns: array of learning events or pattern data showing agent strengths
 */
export function evaluateRoleChange(agent, patterns = []) {
  // Simple heuristic: if agent consistently succeeds in tasks outside their role,
  // suggest a role change. For now, return no recommendation unless patterns are strong.
  if (!agent || !patterns || patterns.length < 5) {
    return { recommended: false, newRole: null, reason: "Insufficient data for role evaluation" };
  }

  // Check if the agent's success patterns indicate a different role
  const taskTypes = patterns.map(p => p.task_type || "").filter(Boolean);
  const typeCounts = {};
  for (const t of taskTypes) {
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  // If >60% of tasks are of a different type than the agent's role, suggest change
  const total = taskTypes.length;
  const currentRole = agent.role;
  const otherTypes = Object.entries(typeCounts)
    .filter(([type]) => !type.toLowerCase().includes(currentRole.split("-")[0]))
    .sort(([, a], [, b]) => b - a);

  if (otherTypes.length > 0 && otherTypes[0][1] / total > 0.6) {
    return {
      recommended: true,
      newRole: null, // Would need taxonomy lookup to find best match
      reason: `Agent performs ${otherTypes[0][0]} tasks ${((otherTypes[0][1] / total) * 100).toFixed(0)}% of the time`,
    };
  }

  return { recommended: false, newRole: null, reason: "Current role is appropriate" };
}

/**
 * archiveExperience(root, agentId, oldRole, rawDigest) → void
 * Saves the raw (unprocessed) experience to an archive for potential future use.
 */
export function archiveExperience(root, agentId, oldRole, rawDigest) {
  const archiveDir = join(root, ".ogu", "marketplace", "experience-archive");
  mkdirSync(archiveDir, { recursive: true });

  const entry = {
    agent_id: agentId,
    role: oldRole,
    digest: rawDigest,
    archived_at: new Date().toISOString(),
  };

  const archivePath = join(archiveDir, `${agentId}-${oldRole}-${Date.now()}.json`);
  writeFileSync(archivePath, JSON.stringify(entry, null, 2) + "\n", "utf-8");
}

/**
 * applyRoleChange(root, agentId, newRoleSlug, playbooksDir) → updated profile
 * Full role change: archive experience, generalize, load new playbook, rebuild prompt.
 */
export function applyRoleChange(root, agentId, newRoleSlug, playbooksDir) {
  const agent = loadAgent(root, agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const newConfig = getRoleConfig(newRoleSlug);
  if (!newConfig) throw new Error(`Unknown role: ${newRoleSlug}`);

  const oldRole = agent.role;
  const oldDigest = agent.experience_digest || "";

  // 1. Archive raw experience
  if (oldDigest) {
    archiveExperience(root, agentId, oldRole, oldDigest);
  }

  // 2. Generalize experience
  const generalizedDigest = generalizeExperience(oldDigest, oldRole, newRoleSlug);

  // 3. Update role
  agent.role = newRoleSlug;
  agent.role_display = newConfig.displayName;
  agent.category = newConfig.category;
  agent.capacity_units = newConfig.capacityUnits;
  agent.experience_digest = generalizedDigest;

  // 4. Load new playbook and rebuild prompt
  try {
    const playbook = loadPlaybookForRole(playbooksDir, newRoleSlug);
    const specialtiesDir = join(playbooksDir, "specialties");
    const specialty = agent.specialty ? loadSpecialty(specialtiesDir, agent.specialty) : null;

    if (playbook) {
      agent.skills = [...(playbook.skills || [])];
      if (specialty) {
        agent.skills = [...new Set([...agent.skills, ...(specialty.skills || [])])];
      }
      agent.system_prompt = assembleSystemPrompt({
        playbook,
        specialty,
        dna: agent.dna,
        experience: generalizedDigest,
      });
    }
  } catch { /* keep existing prompt if playbook not found */ }

  // 5. Save and update role history
  saveAgent(root, agent);
  appendRoleHistory(root, agentId, { role: newRoleSlug, tier: agent.tier });

  // 6. Bump prompt version
  agent.prompt_version = (agent.prompt_version || 0) + 1;
  agent.last_prompt_update = new Date().toISOString();
  saveAgent(root, agent);

  return loadAgent(root, agentId);
}
