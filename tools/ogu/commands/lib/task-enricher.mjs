/**
 * task-enricher.mjs — Slice 419
 * Enriches Plan.json tasks with structured metadata required for execution.
 *
 * Takes an existing plan (Plan.json from docs/vault/ or any task array),
 * a PRD (from pm-engine), and a team (from team-assembler), and adds:
 *
 *   feature_id      — which PRD feature this task contributes to
 *   owner_role      — normalized role name (maps requiredRole/roleId variants)
 *   owner_agent_id  — assigned marketplace agent (from team.json)
 *   definition_of_done — DoD string: AC-based or generated from task description
 *   input_artifacts — file paths this task consumes (from task.inputs or inferred)
 *   output_artifacts — file paths this task produces (from task.outputs)
 *   gates           — gate checks to run after task completes
 *
 * The enriched plan is saved to .ogu/projects/{projectId}/plan.enriched.json.
 * The original Plan.json (in docs/vault/) is NOT modified.
 *
 * Exports:
 *   normalizeRole(raw) → string
 *   mapTaskToFeature(task, features) → feature_id | null
 *   buildDefinitionOfDone(task, feature) → string
 *   inferGates(task) → string[]
 *   enrichTask(task, { prd, team }) → EnrichedTask
 *   enrichPlan(plan, { prd, team }) → EnrichedPlan
 *   savePlan(root, projectId, plan) → void
 *   loadPlan(root, projectId) → EnrichedPlan | null
 *   validateEnrichedTask(task) → { valid, errors }
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectsDir } from './runtime-paths.mjs';

// ── Role normalization ────────────────────────────────────────────────────────

const ROLE_MAP = {
  developer: 'backend_engineer',
  backend: 'backend_engineer',
  'backend-dev': 'backend_engineer',
  'backend_dev': 'backend_engineer',
  frontend: 'frontend_engineer',
  'frontend-dev': 'frontend_engineer',
  'frontend_dev': 'frontend_engineer',
  engineer: 'backend_engineer',
  pm: 'pm',
  'product-manager': 'pm',
  'product_manager': 'pm',
  qa: 'qa',
  'qa-engineer': 'qa',
  'qa_engineer': 'qa',
  tester: 'qa',
  architect: 'architect',
  'tech-lead': 'architect',
  'tech_lead': 'architect',
  devops: 'devops',
  'devops-engineer': 'devops',
  security: 'security',
  'security-engineer': 'security',
  designer: 'designer',
};

/**
 * normalizeRole(raw) → string
 * Maps raw role strings (requiredRole, roleId) to canonical role_id.
 */
export function normalizeRole(raw) {
  if (!raw) return 'backend_engineer';
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, '-');
  return ROLE_MAP[normalized] || ROLE_MAP[raw.toLowerCase()] || raw.toLowerCase();
}

// ── Feature mapping ───────────────────────────────────────────────────────────

/**
 * mapTaskToFeature(task, features) → feature_id | null
 * Keyword-scores features against task name + description.
 * Returns the best-matching feature id, or the first feature id as fallback.
 */
export function mapTaskToFeature(task, features) {
  if (!Array.isArray(features) || features.length === 0) return null;

  const taskText = [task.name, task.description, task.taskName]
    .filter(Boolean).join(' ').toLowerCase();

  let bestId = null;
  let bestScore = 0;

  for (const feat of features) {
    const featText = [feat.title, feat.description]
      .filter(Boolean).join(' ').toLowerCase();

    const featWords = featText.split(/\W+/).filter(w => w.length > 3);
    let score = 0;
    for (const word of featWords) {
      if (taskText.includes(word)) score++;
    }

    // Bonus: role match (PM tasks → PM feature, engineer tasks → implementation)
    const taskRole = normalizeRole(task.requiredRole || task.roleId || '');
    if (feat.id?.includes('auth') && taskText.match(/auth|login|user|account/)) score += 3;
    if (feat.id?.includes('payment') && taskText.match(/pay|stripe|billing|invoice/)) score += 3;
    if (feat.id?.includes('dashboard') && taskText.match(/admin|dashboard|report/)) score += 3;

    if (score > bestScore) { bestScore = score; bestId = feat.id; }
  }

  // Fallback: first feature
  return bestId || features[0].id;
}

// ── DoD builder ───────────────────────────────────────────────────────────────

/**
 * buildDefinitionOfDone(task, feature) → string
 * Constructs a DoD string. Prefers feature acceptance_criteria.
 * Falls back to task-level description if no feature provided.
 */
export function buildDefinitionOfDone(task, feature) {
  const parts = [];

  // Feature acceptance criteria relevant to this task
  if (feature?.acceptance_criteria?.length) {
    // Take up to 2 ACs most relevant to the task
    const taskText = [task.name, task.description].filter(Boolean).join(' ').toLowerCase();
    const relevantACs = feature.acceptance_criteria.filter(ac => {
      const acWords = ac.toLowerCase().split(/\W+/).filter(w => w.length > 3);
      return acWords.some(w => taskText.includes(w));
    });

    if (relevantACs.length > 0) {
      parts.push(...relevantACs.slice(0, 2));
    } else {
      // No AC matches task text — use first feature AC
      parts.push(feature.acceptance_criteria[0]);
    }
  }

  // Always add output existence condition
  const outputs = task.outputs || task.output?.files?.map(f => f.path) || [];
  if (outputs.length > 0) {
    const files = outputs.slice(0, 2).map(p => typeof p === 'string' ? p : p.path).join(', ');
    parts.push(`Output file(s) exist: ${files}`);
  } else {
    parts.push(`Task "${task.name || task.id}" completes without errors`);
  }

  return parts.join('. ');
}

// ── Gate inference ────────────────────────────────────────────────────────────

const GATE_RULES = [
  { pattern: /\.(ts|tsx)$/, gate: 'type-check' },
  { pattern: /\.(test|spec)\.(ts|js|mjs)$/, gate: 'tests-pass' },
  { pattern: /migration|migrate/, gate: 'migration-runs' },
  { pattern: /schema\.json|\.contract\.json/, gate: 'schema-valid' },
  { pattern: /\.mjs$|\.js$/, gate: 'no-syntax-error' },
];

/**
 * inferGates(task) → string[]
 * Infers gate names from output file patterns.
 * Always returns at least ['output-exists'].
 */
export function inferGates(task) {
  const outputs = task.outputs || task.output?.files?.map(f => typeof f === 'string' ? f : f.path) || [];
  const gates = new Set();

  for (const out of outputs) {
    const p = typeof out === 'string' ? out : (out?.path || '');
    for (const rule of GATE_RULES) {
      if (rule.pattern.test(p)) gates.add(rule.gate);
    }
  }

  if (gates.size === 0) gates.add('output-exists');
  return [...gates];
}

// ── Team lookup ───────────────────────────────────────────────────────────────

/**
 * findAgentForRole(team, roleId) → agent_id | null
 */
function findAgentForRole(team, roleId) {
  if (!team?.members) return null;
  const member = team.members.find(m => m.role_id === roleId && m.status === 'active' && m.agent_id);
  return member?.agent_id || null;
}

// ── Single task enrichment ────────────────────────────────────────────────────

/**
 * enrichTask(task, { prd, team }) → EnrichedTask
 * Adds all enriched fields to a single task object.
 * Does NOT mutate the original task — returns a new object.
 */
export function enrichTask(task, { prd, team } = {}) {
  const features = prd?.features || [];
  const feature_id = mapTaskToFeature(task, features);
  const feature = features.find(f => f.id === feature_id) || null;

  const owner_role = normalizeRole(task.requiredRole || task.roleId || task.owner_role);
  const owner_agent_id = team ? findAgentForRole(team, owner_role) : null;

  const definition_of_done = buildDefinitionOfDone(task, feature);
  const gates = task.gates || inferGates(task);

  // Normalize artifacts
  const input_artifacts = task.input_artifacts ||
    (task.inputs || []).map(p => typeof p === 'string' ? p : p.path).filter(Boolean);

  const output_artifacts = task.output_artifacts ||
    (task.outputs || task.output?.files?.map(f => typeof f === 'string' ? f : f.path) || []).filter(Boolean);

  return {
    ...task,
    // Enriched fields
    feature_id,
    owner_role,
    ...(owner_agent_id ? { owner_agent_id } : {}),
    definition_of_done,
    input_artifacts,
    output_artifacts,
    gates,
    // Track enrichment
    _enriched: true,
    _enriched_at: new Date().toISOString(),
  };
}

// ── Plan enrichment ───────────────────────────────────────────────────────────

/**
 * enrichPlan(plan, { prd, team, projectId? }) → EnrichedPlan
 * Enriches all tasks in a plan. Returns a new plan object.
 *
 * plan: { tasks: Task[], featureSlug?, version?, ... }
 * prd: PRDJson from pm-engine
 * team: TeamConfig from team-assembler
 */
export function enrichPlan(plan, { prd, team, projectId } = {}) {
  if (!plan || !Array.isArray(plan.tasks)) {
    throw new Error('enrichPlan: plan must have a tasks array');
  }

  const enrichedTasks = plan.tasks.map(task => enrichTask(task, { prd, team }));

  // Summary stats
  const featureCoverage = {};
  for (const task of enrichedTasks) {
    if (task.feature_id) {
      featureCoverage[task.feature_id] = (featureCoverage[task.feature_id] || 0) + 1;
    }
  }

  const assignedCount = enrichedTasks.filter(t => t.owner_agent_id).length;
  const unassignedCount = enrichedTasks.length - assignedCount;

  return {
    ...plan,
    tasks: enrichedTasks,
    _enrichment: {
      enriched_at: new Date().toISOString(),
      project_id: projectId || plan.projectId || null,
      prd_version: prd?.meta?.version || null,
      total_tasks: enrichedTasks.length,
      assigned_tasks: assignedCount,
      unassigned_tasks: unassignedCount,
      feature_coverage: featureCoverage,
    },
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

const ENRICHED_REQUIRED = ['feature_id', 'owner_role', 'definition_of_done', 'gates', 'input_artifacts', 'output_artifacts'];

/**
 * validateEnrichedTask(task) → { valid, errors }
 */
export function validateEnrichedTask(task) {
  const errors = [];
  if (!task || typeof task !== 'object') return { valid: false, errors: ['task is not an object'] };

  for (const field of ENRICHED_REQUIRED) {
    if (task[field] === undefined || task[field] === null) {
      errors.push(`${field} missing`);
    }
  }

  if (!Array.isArray(task.gates)) errors.push('gates must be an array');
  if (task.gates?.length === 0) errors.push('gates must not be empty');
  if (!Array.isArray(task.input_artifacts)) errors.push('input_artifacts must be an array');
  if (!Array.isArray(task.output_artifacts)) errors.push('output_artifacts must be an array');
  if (typeof task.definition_of_done !== 'string' || !task.definition_of_done) {
    errors.push('definition_of_done must be a non-empty string');
  }

  return { valid: errors.length === 0, errors };
}

// ── Storage ───────────────────────────────────────────────────────────────────

function projectDir(root, projectId) {
  return join(getProjectsDir(root), projectId);
}

/**
 * savePlan(root, projectId, plan) → void
 * Saves enriched plan to .ogu/projects/{projectId}/plan.enriched.json
 */
export function savePlan(root, projectId, plan) {
  const dir = projectDir(root, projectId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'plan.enriched.json'), JSON.stringify(plan, null, 2), 'utf-8');
}

/**
 * loadPlan(root, projectId) → EnrichedPlan | null
 */
export function loadPlan(root, projectId) {
  const path = join(projectDir(root, projectId), 'plan.enriched.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}
