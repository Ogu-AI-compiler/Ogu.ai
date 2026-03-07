/**
 * marketplace-bridge.mjs — Slice 379 + Slice 393 + Slice 399 (skill routing)
 * Single integration layer between the execution pipeline (agent-executor,
 * prompt-builder, task-allocator) and the marketplace subsystem
 * (agent-store, marketplace-allocator, pattern-store, learning-event, pricing-engine).
 *
 * Slice 399 adds: skill-router lazy loading integration
 *   - enrichTaskWithAgent() — routes task to relevant skills (Level 2 loading)
 *   - enrichTaskForProject() — full pipeline: resolve agents → enrich task
 *   - injectSkillsIntoSystemPrompt() — per-task skill injection (not static)
 *   - selectAgentForTask() — picks best-fit agent from project allocation
 *
 * All marketplace imports are concentrated here so old pipeline files
 * only gain one import line.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { listProjectAllocations } from './marketplace-allocator.mjs';
import { loadAgent, updateAgentStats } from './agent-store.mjs';
import { searchPatterns, injectIntoPrompt } from './pattern-store.mjs';
import { detectLearningTrigger, createLearningCandidate } from './learning-event.mjs';
import { computeMultiplier } from './pricing-engine.mjs';
import { buildExperienceLayer } from './prompt-assembler.mjs';
import { routeTask } from './skill-router.mjs';
import { defaultSkillsDir } from './skill-loader.mjs';
import { getMarketplaceDir, getProjectsDir } from './runtime-paths.mjs';

const ROLE_ALIASES = {
  'backend-dev': ['backend_engineer', 'backend-engineer', 'backend'],
  'frontend-dev': ['frontend_engineer', 'frontend-engineer', 'frontend', 'ui', 'designer'],
  devops: ['devops_engineer', 'devops-engineer', 'ops', 'infra', 'platform', 'sre'],
  qa: ['qa_engineer', 'qa-engineer', 'quality', 'tester', 'test'],
  architect: ['architecture', 'tech_lead', 'tech-lead', 'technical_lead', 'technical-lead'],
  pm: ['product_manager', 'product-manager', 'product'],
  security: ['security_engineer', 'security-engineer', 'appsec', 'infosec'],
};

function normalizeRoleId(roleId) {
  return String(roleId || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_');
}

function getRoleAliases(roleId) {
  const key = normalizeRoleId(roleId);
  const aliases = new Set([key]);
  const extra = ROLE_ALIASES[key] || [];
  for (const alias of extra) {
    aliases.add(normalizeRoleId(alias));
  }
  return [...aliases];
}

/**
 * Check whether the marketplace subsystem exists on disk.
 */
function marketplaceExists(root) {
  return existsSync(getMarketplaceDir(root));
}

/**
 * resolveMarketplaceAgent(root, { featureSlug, roleId, phase })
 *
 * Looks up whether a marketplace agent has been hired for this
 * feature + role combination. Returns its system prompt, skills, and DNA
 * so the executor can overlay them onto the OrgSpec role.
 *
 * @returns {{ found: true, agent: object, systemPrompt: string, skills: string[], dna: object } | { found: false }}
 */
export function resolveMarketplaceAgent(root, { featureSlug, roleId, phase } = {}) {
  if (!marketplaceExists(root)) return { found: false };

  let allocations;
  try {
    allocations = listProjectAllocations(root, featureSlug);
  } catch {
    return { found: false };
  }

  if (!allocations || allocations.length === 0) return { found: false };

  // Filter active allocations matching roleId (via role_slot)
  const roleAliases = roleId ? getRoleAliases(roleId) : null;
  const matching = allocations.filter(a => {
    if (!roleId) return true;
    const slot = normalizeRoleId(a.role_slot || a.roleSlot || a.role_id || a.roleId);
    return roleAliases.includes(slot);
  });

  if (matching.length === 0 && roleId && featureSlug) {
    try {
      const teamPath = join(getProjectsDir(root), featureSlug, 'team.json');
      if (existsSync(teamPath)) {
        const team = JSON.parse(readFileSync(teamPath, 'utf8'));
        const members = Array.isArray(team?.members) ? team.members : [];
        const desired = new Set(getRoleAliases(roleId));
        const pick = members.find(m => {
          if (m?.status !== 'active' || !m?.agent_id) return false;
          const roleKey = normalizeRoleId(m?.role_id || m?.roleId || m?.role_display || m?.roleDisplay || '');
          return desired.has(roleKey);
        }) || members.find(m => m?.status === 'active' && m?.agent_id);
        if (pick?.agent_id) {
          const agent = loadAgent(root, pick.agent_id);
          if (agent) {
            return {
              found: true,
              agent,
              systemPrompt: agent.system_prompt || '',
              skills: agent.skills || agent.capabilities || [],
              dna: agent.dna || {},
              promptVersion: agent.prompt_version || 0,
            };
          }
        }
      }
    } catch { /* ignore team fallback */ }
  }

  if (matching.length === 0) return { found: false };

  // Pick highest-priority allocation
  const best = matching.sort((a, b) => (a.priority_level ?? 50) - (b.priority_level ?? 50))[0];

  const agent = loadAgent(root, best.agent_id);
  if (!agent) return { found: false };

  // V2 agents: dynamically inject relevant experience into Layer 4
  let systemPrompt = agent.system_prompt || '';
  if (agent.profile_version === 2 && agent.experience_digest) {
    try {
      const taskPatterns = phase ? [phase] : [];
      const relevantDigest = filterExperienceForTask(agent.experience_digest, taskPatterns);
      const expLayer = buildExperienceLayer(relevantDigest);

      if (expLayer && !systemPrompt.includes("## Learned Experience Rules")) {
        systemPrompt += "\n\n---\n\n" + expLayer;
      }
    } catch { /* fallback to stored prompt */ }
  }

  return {
    found: true,
    agent,
    systemPrompt,
    skills: agent.skills || agent.capabilities || [],
    dna: agent.dna || {},
    promptVersion: agent.prompt_version || 0,
  };
}

/**
 * filterExperienceForTask(digest, taskPatterns) → filtered digest string
 * Selects experience rules relevant to the current task context.
 */
function filterExperienceForTask(digest, taskPatterns = []) {
  if (!digest || !taskPatterns.length) return digest;
  const rules = digest.split("\n").filter(Boolean);
  // Return all rules — filtering by task pattern is best-effort
  // In practice, rules are already concise enough to include all
  return rules.join("\n");
}

/**
 * searchRelevantPatterns(root, { taskType, featureSlug })
 *
 * Searches the marketplace pattern store for learned patterns
 * relevant to the current task. Returns a formatted prompt section
 * string (or empty string if nothing found).
 */
export function searchRelevantPatterns(root, { taskType, featureSlug } = {}) {
  if (!marketplaceExists(root)) return '';
  if (!existsSync(join(getMarketplaceDir(root), 'patterns'))) return '';

  try {
    const patterns = searchPatterns(root, {
      taskType,
      contextSignature: featureSlug ? [featureSlug] : [],
    });
    return injectIntoPrompt(patterns);
  } catch {
    return '';
  }
}

/**
 * postExecutionHooks(root, { agentId, taskId, featureSlug, success, iterationCount, gateFailed, durationMs })
 *
 * Best-effort post-execution hook. Fires learning triggers and
 * updates agent stats/pricing after a marketplace agent completes a task.
 * Never throws — all errors are silently swallowed.
 */
export function postExecutionHooks(root, {
  agentId,
  taskId,
  featureSlug,
  success = true,
  iterationCount = 0,
  gateFailed = false,
  durationMs = 0,
} = {}) {
  // Guard: only run for marketplace agents (agent_XXXX IDs)
  if (!agentId || !agentId.startsWith('agent_')) return;
  if (!marketplaceExists(root)) return;

  try {
    // 1. Detect learning trigger
    const trigger = detectLearningTrigger({
      gateFailed,
      iterationCount,
      reviewerChangedStrategy: false,
      durationDrop: 0,
    });

    // 2. Create learning candidate if triggered
    if (trigger) {
      createLearningCandidate(root, {
        agentId,
        taskType: taskId,
        contextSignature: featureSlug ? [featureSlug] : [],
        failureSignals: gateFailed ? ['gate_failure'] : [],
        resolutionSummary: success ? 'Task completed successfully' : 'Task failed',
        iterationCount,
        trigger,
      });
    }

    // 3. Update agent stats
    const agent = loadAgent(root, agentId);
    if (agent) {
      const delta = {};
      if (success) {
        delta.projects_completed = (agent.stats?.projects_completed || 0) + 1;
        delta.success_rate = ((agent.stats?.success_rate || 0.8) * (agent.stats?.projects_completed || 0) + 1)
          / ((agent.stats?.projects_completed || 0) + 1);
      } else {
        delta.success_rate = ((agent.stats?.success_rate || 0.8) * (agent.stats?.projects_completed || 0))
          / ((agent.stats?.projects_completed || 0) + 1);
      }
      delta.last_task_duration_ms = durationMs;
      updateAgentStats(root, agentId, delta);

      // 4. Recompute performance multiplier
      const updatedAgent = loadAgent(root, agentId);
      if (updatedAgent) {
        const mult = computeMultiplier(root, {
          ...updatedAgent.stats,
          capacity_units: updatedAgent.capacity_units || 5,
        });
        updateAgentStats(root, agentId, { performance_multiplier: mult });
      }
    }
  } catch {
    // Best-effort — never throw
  }
}

// ── Skill routing integration (Slice 399) ────────────────────────────────────

/**
 * getProjectAgents(root, projectId) → AgentProfile[]
 * Returns all marketplace agents currently hired to a project.
 */
export function getProjectAgents(root, projectId) {
  if (!projectId || !marketplaceExists(root)) return [];
  try {
    const allocations = listProjectAllocations(root, projectId);
    const agents = [];
    for (const alloc of allocations) {
      try {
        const agent = loadAgent(root, alloc.agent_id || alloc.agentId);
        if (agent) agents.push(agent);
      } catch { /* skip */ }
    }
    return agents;
  } catch {
    return [];
  }
}

/**
 * selectAgentForTask(agents, task) → AgentProfile | null
 * Picks the best-fit agent for a task based on role and skill overlap.
 * task: { type?, description?, role?, taskType? }
 */
export function selectAgentForTask(agents, task) {
  if (!Array.isArray(agents) || agents.length === 0) return null;
  if (!task) return agents[0];

  const taskText = [task.description, task.type, task.taskType, task.role]
    .filter(Boolean).join(" ").toLowerCase();

  let best = null;
  let bestScore = -1;

  for (const agent of agents) {
    let score = 0;

    // Role match
    const agentRole = (agent.role || "").toLowerCase();
    if (task.role && agentRole.includes(task.role.toLowerCase())) score += 10;
    if (task.taskType && agentRole.includes(task.taskType.toLowerCase())) score += 8;

    // Skill name overlap with task description
    for (const skillName of (agent.skills || [])) {
      for (const w of skillName.split("-")) {
        if (w.length > 3 && taskText.includes(w)) score += 1;
      }
    }

    // Prefer higher tier
    score += (agent.tier || 1) * 0.5;

    if (score > bestScore) { bestScore = score; best = agent; }
  }

  return best;
}

/**
 * enrichTaskWithAgent(task, agent, opts?) → EnrichedTask
 * Routes task through skill-router (lazy loading) to inject skill context.
 *
 * task: { id?, description?, type?, taskType?, prompt?, projectId? }
 * agent: AgentProfile
 * opts.skillsDir, opts.maxSkills, opts.loadBodies
 */
export function enrichTaskWithAgent(task, agent, opts = {}) {
  if (!task || !agent) return task ?? {};

  const skillsDir = opts.skillsDir || defaultSkillsDir();
  const taskDescription = [task.description, task.type, task.taskType].filter(Boolean).join(". ");

  const skillDefs = agent.skill_definitions || [];
  const { skills: matchedSkills, context: skillContext } = routeTask(
    taskDescription,
    skillDefs,
    skillsDir,
    { maxSkills: opts.maxSkills ?? 3, loadBodies: opts.loadBodies !== false }
  );

  const agentHeader = buildAgentHeader(agent);
  const enrichedPrompt = buildEnrichedPrompt(task.prompt || task.description || "", agentHeader, skillContext);

  return {
    ...task,
    agentId: agent.agent_id,
    agentContext: agentHeader,
    skillContext,
    matchedSkills: matchedSkills.map(s => s.name),
    enrichedPrompt,
  };
}

/**
 * enrichTaskForProject(root, task, opts?) → EnrichedTask
 * Full pipeline: resolve hired agents → select best → enrich with skills.
 * Returns task unchanged if no agents hired to the project.
 */
export function enrichTaskForProject(root, task, opts = {}) {
  const projectId = task.projectId || task.project_id || opts.projectId;
  if (!projectId) return task;

  const agents = getProjectAgents(root, projectId);
  if (agents.length === 0) return task;

  const agent = selectAgentForTask(agents, task);
  if (!agent) return task;

  return enrichTaskWithAgent(task, agent, opts);
}

/**
 * buildAgentHeader(agent) → string
 * Formats agent identity as a context header for task prompts.
 */
export function buildAgentHeader(agent) {
  if (!agent) return "";
  return [
    `## Hired Agent: ${agent.name}`,
    `Role: ${agent.role_display || agent.role} · Tier ${agent.tier} · Specialty: ${agent.specialty || "general"}`,
    `DNA: work=${agent.dna?.work_style}, comms=${agent.dna?.communication_style}, strength=${agent.dna?.strength_bias}`,
  ].join("\n");
}

/**
 * buildEnrichedPrompt(basePrompt, agentContext, skillContext) → string
 * Combines base task prompt with agent and skill context layers.
 */
export function buildEnrichedPrompt(basePrompt, agentContext, skillContext) {
  const parts = [];
  if (agentContext) parts.push(agentContext);
  if (skillContext) parts.push(skillContext);
  if (basePrompt) parts.push(`## Task\n\n${basePrompt}`);
  return parts.join("\n\n---\n\n");
}

/**
 * injectSkillsIntoSystemPrompt(systemPrompt, agent, taskDescription, opts?) → string
 * Lazily injects relevant skill bodies into a system prompt for a specific task.
 * This is the lazy-loading pattern: per-task injection, not static.
 */
export function injectSkillsIntoSystemPrompt(systemPrompt, agent, taskDescription, opts = {}) {
  if (!agent || !taskDescription) return systemPrompt || "";

  const skillsDir = opts.skillsDir || defaultSkillsDir();
  const skillDefs = agent.skill_definitions || [];
  const { context } = routeTask(taskDescription, skillDefs, skillsDir, {
    maxSkills: opts.maxSkills ?? 3,
    loadBodies: opts.loadBodies !== false,
  });

  if (!context) return systemPrompt || "";
  return `${systemPrompt || ""}\n\n---\n\n${context}`;
}

/**
 * enrichRunnerInput(root, runnerInputPath, opts?) → boolean
 * Reads a runner input file, enriches with agent/skill context, writes back.
 */
export function enrichRunnerInput(root, runnerInputPath, opts = {}) {
  if (!existsSync(runnerInputPath)) return false;

  let input;
  try { input = JSON.parse(readFileSync(runnerInputPath, "utf-8")); }
  catch { return false; }

  const projectId = input.projectId || input.project_id || opts.projectId;
  if (!projectId) return false;

  const enriched = enrichTaskForProject(root, input, { ...opts, projectId });
  if (!enriched.agentId) return false;

  try {
    writeFileSync(runnerInputPath, JSON.stringify(enriched, null, 2), "utf-8");
    return true;
  } catch { return false; }
}
