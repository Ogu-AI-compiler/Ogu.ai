/**
 * agent-trainer.mjs — Slice 390 + Slice 398
 * Agent Trainer: post-compile learning cycle for marketplace agents.
 *
 * Slice 390 training flow:
 * 1. Collect pending learning candidates for agent
 * 2. Distill into concrete rules (checklist, not prose)
 * 3. Append to experience_digest
 * 4. Compress if > 50 rules
 * 5. Evaluate tier change (promote/demote)
 * 6. Update tier, price, role_history if changed
 * 7. Re-assemble system prompt with updated Layer 4
 * 8. Bump prompt_version, save profile
 * 9. Log to .ogu/marketplace/trainer/
 *
 * Slice 398 additions:
 * - getPendingCandidatesForAgent(root, agentId) → candidate[]
 * - buildExperienceDigest(patterns) → string
 * - rebuildAgentPrompt(agent, opts?) → string
 * - getAgentPatternDigest(root, agentId) → string
 * - trainAgent updated to return { summary, rulesAdded, promptVersion, dryRun }
 * - trainAll updated to return { trained, skipped, errors }
 * Learning state stored in .ogu/marketplace/training/
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { getMarketplaceDir } from "./runtime-paths.mjs";
import { listPendingCandidates, markCandidateProcessed } from "./learning-event.mjs";
import { abstractCandidate } from "./reflector.mjs";
import {
  savePattern,
  findSimilarPattern,
  mergePattern,
  searchPatterns,
} from "./pattern-store.mjs";
import { loadAgent, saveAgent, listAgents, updateExperience, bumpPromptVersion, appendRoleHistory } from "./agent-store.mjs";
import { assembleSystemPrompt, buildExperienceLayer } from "./prompt-assembler.mjs";
import { loadPlaybookForRole } from "./playbook-loader.mjs";
import { resolveSkills, defaultSkillsDir } from "./skill-loader.mjs";
import { loadSpecialty } from "./specialty-loader.mjs";

const MAX_RULES = 50;
const MAX_DIGEST_RULES = 20; // Slice 398: digest cap
const PROMOTE_SUCCESS_THRESHOLD = 0.9;
const PROMOTE_PROJECTS_THRESHOLD = { 1: 5, 2: 10, 3: 20, 4: Infinity };
const DEMOTE_SUCCESS_THRESHOLD = 0.6;

function trainerDir(root) {
  return join(getMarketplaceDir(root), "trainer");
}

function trainingDir(root) {
  return join(getMarketplaceDir(root), "training");
}

function ensureTrainerDir(root) {
  mkdirSync(trainerDir(root), { recursive: true });
}

function ensureTrainingDir(root) {
  mkdirSync(trainingDir(root), { recursive: true });
}

function defaultPlaybooksDir() {
  const thisFile = new URL(import.meta.url).pathname;
  return join(thisFile, "..", "..", "playbooks");
}

// ─── Slice 398 exports ───────────────────────────────────────────────────────

/**
 * getPendingCandidatesForAgent(root, agentId) → candidate[]
 * Filters listPendingCandidates by agentId.
 */
export function getPendingCandidatesForAgent(root, agentId) {
  const all = listPendingCandidates(root);
  return all.filter(c => c.agent_id === agentId);
}

/**
 * buildExperienceDigest(patterns) → string
 * Takes top patterns from pattern-store, formats as digest (one rule per line).
 * Max 20 rules, sorted by confidence desc.
 */
export function buildExperienceDigest(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return "";

  const sorted = [...patterns]
    .filter(p => p && p.active !== false)
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, MAX_DIGEST_RULES);

  if (sorted.length === 0) return "";

  return sorted.map(p => {
    const summary = (p.resolution_summary || "").trim();
    const taskType = p.task_type ? `[${p.task_type}]` : "";
    const conf = typeof p.confidence === "number" ? ` (confidence: ${p.confidence.toFixed(2)})` : "";
    if (summary) {
      return `${taskType} ${summary}${conf}`.trim();
    }
    const tags = (p.context_signature || []).join(", ");
    return `${taskType} Apply learned pattern for: ${tags}${conf}`.trim();
  }).join("\n");
}

/**
 * getAgentPatternDigest(root, agentId) → string
 * Finds patterns relevant to agent's task types, formats as digest.
 */
export function getAgentPatternDigest(root, agentId) {
  const agent = loadAgent(root, agentId);
  if (!agent) return "";

  const taskType = agent.role || null;
  const contextSignature = Array.isArray(agent.skills)
    ? agent.skills.slice(0, 5).map(s => `skill:${s}`)
    : [];

  const patterns = searchPatterns(root, { taskType, contextSignature }, MAX_DIGEST_RULES);
  return buildExperienceDigest(patterns);
}

/**
 * rebuildAgentPrompt(agent, opts?) → string
 * Reassembles system prompt from agent's current data (playbook, skills, dna, experience).
 * opts.playbooksDir, opts.skillsDir
 */
export function rebuildAgentPrompt(agent, opts = {}) {
  const pbDir = opts.playbooksDir || defaultPlaybooksDir();
  const skDir = opts.skillsDir || defaultSkillsDir();

  const roleSlug = agent.role || null;
  let playbook = null;
  if (roleSlug) {
    try {
      playbook = loadPlaybookForRole(pbDir, roleSlug);
    } catch {
      // Playbook not available — fall back to existing system_prompt
    }
  }

  // If no playbook, append experience layer to existing system_prompt
  if (!playbook) {
    const base = (agent.system_prompt || "").trim();
    const expLayer = buildExperienceLayer(agent.experience_digest || "");
    if (!expLayer) return base;
    return base ? `${base}\n\n---\n\n${expLayer}` : expLayer;
  }

  const skillNames = Array.isArray(agent.skills) ? agent.skills : [];
  const skillDefs = resolveSkills(skDir, skillNames);

  return assembleSystemPrompt({
    playbook,
    specialty: null,
    skills: skillDefs,
    dna: agent.dna || {},
    experience: agent.experience_digest || "",
  });
}

function logTraining(root, entry) {
  ensureTrainerDir(root);
  const logFile = join(trainerDir(root), "training-log.jsonl");
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + "\n";
  try { appendFileSync(logFile, line, "utf-8"); } catch { /* best-effort */ }
}

/**
 * distillExperience(learningEvents, existingDigest) → string of concrete rules
 */
export function distillExperience(learningEvents, existingDigest = "") {
  const existingRules = existingDigest
    ? existingDigest.split("\n").map(l => l.trim()).filter(Boolean)
    : [];

  const newRules = [];

  for (const event of learningEvents) {
    const trigger = event.trigger || "unknown";
    const summary = event.resolution_summary || "";
    const taskType = event.task_type || "task";
    const signals = (event.failure_signals || []).join(", ");

    if (trigger === "gate_failure" && signals) {
      newRules.push(`When ${taskType}: check for ${signals} before submitting`);
    } else if (trigger === "excessive_iterations") {
      newRules.push(`When ${taskType}: reduce iteration count by validating early (was ${event.iteration_count} iterations)`);
    } else if (trigger === "review_rejection") {
      newRules.push(`When ${taskType}: align with reviewer expectations upfront — ${summary}`);
    } else if (trigger === "exceptional_improvement") {
      newRules.push(`Success pattern for ${taskType}: ${summary}`);
    } else if (summary) {
      newRules.push(`Learned from ${taskType}: ${summary}`);
    }
  }

  // Deduplicate
  const allRules = [...existingRules, ...newRules];
  const unique = [...new Set(allRules)];

  return unique.join("\n");
}

/**
 * compressExperience(digest, maxRules) → compressed digest (top N rules)
 */
export function compressExperience(digest, maxRules = MAX_RULES) {
  if (!digest) return "";
  const rules = digest.split("\n").map(l => l.trim()).filter(Boolean);
  if (rules.length <= maxRules) return digest;
  return rules.slice(0, maxRules).join("\n");
}

/**
 * evaluateTierChange(agent, events) → { action: "promote"|"demote"|"none", reason }
 */
export function evaluateTierChange(agent, events) {
  const stats = agent.stats || {};
  const successRate = stats.success_rate ?? 0.8;
  const projects = stats.projects_completed ?? 0;
  const currentTier = agent.tier || 1;

  const promotionThreshold = PROMOTE_PROJECTS_THRESHOLD[currentTier] ?? 10;
  if (successRate >= PROMOTE_SUCCESS_THRESHOLD && projects >= promotionThreshold && currentTier < 4) {
    return {
      action: "promote",
      reason: `Success rate ${(successRate * 100).toFixed(0)}% with ${projects} projects exceeds Tier ${currentTier} threshold`,
    };
  }

  if (successRate < DEMOTE_SUCCESS_THRESHOLD && projects >= 3 && currentTier > 1) {
    return {
      action: "demote",
      reason: `Success rate ${(successRate * 100).toFixed(0)}% below ${DEMOTE_SUCCESS_THRESHOLD * 100}% threshold`,
    };
  }

  return { action: "none", reason: "No tier change warranted" };
}

/**
 * trainAgent(root, agentId, options?) → { summary, rulesAdded, promptVersion, dryRun }
 *
 * Slice 398 signature. Also handles Slice 390 learning cycle internally.
 */
export async function trainAgent(root, agentId, options = {}) {
  const { dryRun = false, playbooksDir } = options;
  ensureTrainingDir(root);

  const agent = loadAgent(root, agentId);
  if (!agent) {
    return {
      summary: "agent not found",
      rulesAdded: 0,
      promptVersion: 0,
      dryRun,
    };
  }

  // 1. Collect pending candidates for this agent
  const agentCandidates = getPendingCandidatesForAgent(root, agentId);

  if (agentCandidates.length === 0) {
    return {
      summary: "no pending candidates",
      rulesAdded: 0,
      promptVersion: agent.prompt_version || 1,
      dryRun,
    };
  }

  // 2. Evaluate tier change (always computed, for logging)
  const tierEval = evaluateTierChange(agent, agentCandidates);

  if (dryRun) {
    const newRules = agentCandidates.length; // estimate: one rule per candidate
    return {
      summary: `${agentCandidates.length} candidates would be processed, tier: ${tierEval.action}`,
      rulesAdded: newRules,
      promptVersion: (agent.prompt_version || 1) + 1,
      dryRun: true,
      tierChange: tierEval,
      candidateCount: agentCandidates.length,
    };
  }

  // 3. Abstract each candidate through reflector → save/merge into pattern store
  let rulesAdded = 0;
  const processedIds = [];

  for (const candidate of agentCandidates) {
    const pattern = abstractCandidate(candidate);
    const tags = pattern.context_signature;
    const existing = await findSimilarPattern(root, tags);
    if (existing) {
      mergePattern(root, existing.pattern_id, pattern);
    } else {
      savePattern(root, pattern);
      rulesAdded++;
    }
    processedIds.push(candidate.event_id);
  }

  // 4. Build experience digest from top patterns for this agent
  const agentTaskType = agent.role || null;
  const agentContextSig = Array.isArray(agent.skills)
    ? agent.skills.slice(0, 5).map(s => `skill:${s}`)
    : [];
  const topPatterns = searchPatterns(root, { taskType: agentTaskType, contextSignature: agentContextSig }, MAX_DIGEST_RULES);
  const patternDigest = buildExperienceDigest(topPatterns);

  // 5. Also distill rules from raw candidates (Slice 390 style) and merge
  const legacyDigest = distillExperience(agentCandidates, agent.experience_digest || "");
  const combinedRaw = [patternDigest, legacyDigest].filter(Boolean).join("\n");
  const compressed = compressExperience(combinedRaw, MAX_RULES);

  // 6. Apply tier change if needed
  let updatedAgent = loadAgent(root, agentId);
  if (tierEval.action === "promote") {
    updatedAgent.tier = Math.min(4, updatedAgent.tier + 1);
    updatedAgent.base_price = { 1: 1.5, 2: 4, 3: 8, 4: 16 }[updatedAgent.tier] ?? updatedAgent.tier * 2;
    saveAgent(root, updatedAgent);
    appendRoleHistory(root, agentId, { role: updatedAgent.role, tier: updatedAgent.tier });
  } else if (tierEval.action === "demote") {
    updatedAgent.tier = Math.max(1, updatedAgent.tier - 1);
    updatedAgent.base_price = { 1: 1.5, 2: 4, 3: 8, 4: 16 }[updatedAgent.tier] ?? updatedAgent.tier * 2;
    saveAgent(root, updatedAgent);
    appendRoleHistory(root, agentId, { role: updatedAgent.role, tier: updatedAgent.tier });
  }

  // 7. Update experience on agent profile
  const lastEventId = processedIds[processedIds.length - 1] || null;
  updateExperience(root, agentId, {
    digest: compressed,
    sourcesCount: (agent.experience_sources_count || 0) + agentCandidates.length,
    learningEventId: lastEventId,
  });

  // 8. Re-assemble system prompt
  const pbDir = playbooksDir || defaultPlaybooksDir();
  try {
    const freshAgent = loadAgent(root, agentId);
    const newPrompt = rebuildAgentPrompt(freshAgent, { playbooksDir: pbDir });
    freshAgent.system_prompt = newPrompt;
    saveAgent(root, freshAgent);
  } catch { /* best-effort prompt rebuild */ }

  // 9. Bump prompt version
  const bumpedAgent = bumpPromptVersion(root, agentId);
  const newPromptVersion = bumpedAgent?.prompt_version || (agent.prompt_version || 1) + 1;

  // 10. Mark candidates processed
  for (const eventId of processedIds) {
    try { markCandidateProcessed(root, eventId); } catch { /* skip */ }
  }

  // 11. Log
  logTraining(root, {
    agent_id: agentId,
    candidates_processed: agentCandidates.length,
    rules_added: rulesAdded,
    tier_change: tierEval.action,
    rules_count: compressed.split("\n").filter(Boolean).length,
  });

  return {
    summary: `processed ${agentCandidates.length} candidate(s), added ${rulesAdded} rule(s)`,
    rulesAdded,
    promptVersion: newPromptVersion,
    dryRun: false,
    tierChange: tierEval,
    candidateCount: agentCandidates.length,
  };
}

/**
 * trainAll(root, options?) → { trained, skipped, errors }
 *
 * Trains all agents that have pending learning candidates.
 */
export async function trainAll(root, options = {}) {
  ensureTrainingDir(root);

  const allCandidates = listPendingCandidates(root);
  const agentIdsWithCandidates = new Set(allCandidates.map(c => c.agent_id));

  // If no candidates at all, return early
  if (agentIdsWithCandidates.size === 0) {
    return { trained: 0, skipped: 0, errors: [] };
  }

  // Get all known agents from store
  const storeEntries = listAgents(root);
  const storeIds = new Set(storeEntries.map(e => e.agent_id));

  let trained = 0;
  let skipped = 0;
  const errors = [];

  // Train agents that exist in store and have candidates
  for (const entry of storeEntries) {
    const agentId = entry.agent_id;
    if (!agentIdsWithCandidates.has(agentId)) {
      skipped++;
      continue;
    }
    try {
      const result = await trainAgent(root, agentId, options);
      if (result.summary === "no pending candidates" || result.summary === "agent not found") {
        skipped++;
      } else {
        trained++;
      }
    } catch (e) {
      errors.push({ agentId, error: e.message });
    }
  }

  // Record errors for candidates whose agents don't exist
  for (const agentId of agentIdsWithCandidates) {
    if (!storeIds.has(agentId)) {
      errors.push({ agentId, error: "Agent not found in store" });
    }
  }

  return { trained, skipped, errors };
}
