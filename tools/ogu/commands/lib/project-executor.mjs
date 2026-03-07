/**
 * project-executor.mjs — Slice 420
 * Executes an enriched plan by routing tasks through executeAgentTaskCore.
 *
 * Reads plan.enriched.json from .ogu/projects/{projectId}/
 * Saves execution state to .ogu/projects/{projectId}/execution-state.json
 *
 * Exports:
 *   topologicalSort(tasks) → Task[]
 *   runProject(root, projectId, opts) → ExecutionResult
 *   getExecutionState(root, projectId) → ExecutionState | null
 *   readProjectData(root, projectId) → ProjectData | null
 *   launchProjectPipeline(root, projectId, brief, opts) → PipelineResult
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadPlan, savePlan } from './task-enricher.mjs';
import { planProject, saveCTOPlan } from './cto-planner.mjs';
import { assembleTeam, saveTeam } from './team-assembler.mjs';
import { generatePRD, savePRD } from './pm-engine.mjs';
import { generateTaskGraph } from './architect.mjs';
import { executeTaskGraph } from './task-graph-executor.mjs';
import { finalizeProjectMemory } from './execution-memory.mjs';
import { aggregateMetrics } from './execution-metrics.mjs';
import { getProjectsDir } from './runtime-paths.mjs';

// ── Helpers ───────────────────────────────────────────────────────────────────

function projectDir(root, projectId) {
  return join(getProjectsDir(root), projectId);
}

function readJsonFile(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

function saveJsonFile(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Topological sort ─────────────────────────────────────────────────────────

/**
 * topologicalSort(tasks) → Task[]
 * Kahn's algorithm. Falls back to appending cycle members at end.
 */
export function topologicalSort(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return [];

  const byId = new Map(tasks.map(t => [t.id, t]));
  const inDegree = new Map(tasks.map(t => [t.id, 0]));
  const adjList = new Map(tasks.map(t => [t.id, []]));

  for (const task of tasks) {
    const deps = task.dependsOn || task.depends_on || [];
    for (const dep of deps) {
      if (byId.has(dep)) {
        adjList.get(dep).push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
      }
    }
  }

  const queue = tasks.filter(t => !inDegree.get(t.id)).map(t => t.id);
  const sorted = [];

  while (queue.length > 0) {
    const id = queue.shift();
    const task = byId.get(id);
    if (task) sorted.push(task);
    for (const next of (adjList.get(id) || [])) {
      const deg = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  // Append any cycle members (unresolved) in original order
  if (sorted.length < tasks.length) {
    const seen = new Set(sorted.map(t => t.id));
    for (const t of tasks) {
      if (!seen.has(t.id)) sorted.push(t);
    }
  }

  return sorted;
}

// ── Execution state ───────────────────────────────────────────────────────────

/**
 * getExecutionState(root, projectId) → ExecutionState | null
 */
export function getExecutionState(root, projectId) {
  return readJsonFile(join(projectDir(root, projectId), 'execution-state.json'));
}

function saveExecutionState(root, projectId, state) {
  const dir = projectDir(root, projectId);
  mkdirSync(dir, { recursive: true });
  saveJsonFile(join(dir, 'execution-state.json'), state);
}

// ── Project data reader ───────────────────────────────────────────────────────

/**
 * readProjectData(root, projectId) → ProjectData | null
 * Returns all project artifacts from .ogu/projects/{projectId}/
 */
export function readProjectData(root, projectId) {
  const dir = projectDir(root, projectId);
  if (!existsSync(dir)) return null;

  return {
    projectId,
    ctoPlan: readJsonFile(join(dir, 'cto-plan.json')),
    team: readJsonFile(join(dir, 'team.json')),
    prd: readJsonFile(join(dir, 'prd.json')),
    enrichedPlan: readJsonFile(join(dir, 'plan.enriched.json')),
    executionState: readJsonFile(join(dir, 'execution-state.json')),
  };
}

// ── Full pipeline launcher ────────────────────────────────────────────────────

/**
 * launchProjectPipeline(root, projectId, brief, opts) → PipelineResult
 * Orchestrates: CTO Plan → Team Assembly → PRD → Task Enrichment.
 * Does NOT run execution (call runProject separately).
 *
 * opts:
 *   simulate  — use simulate mode for PRD generation (default: false)
 *   prdOpts   — options passed to generatePRD
 */
export async function launchProjectPipeline(root, projectId, brief, opts = {}) {
  const { simulate: simulateRequested = false, prdOpts = {} } = opts;
  const simulate = false;
  if (simulateRequested) {
    console.warn('[project-executor] simulate requested but disabled — forcing real API calls');
  }

  const dir = projectDir(root, projectId);
  mkdirSync(dir, { recursive: true });

  // Phase 1: CTO Plan
  const ctoPlan = planProject(brief, { projectId });
  saveCTOPlan(root, projectId, ctoPlan);

  // Phase 2: Team Assembly
  const team = assembleTeam(root, {
    projectId,
    teamBlueprint: ctoPlan.teamBlueprint,
  });
  saveTeam(root, projectId, team);

  // Phase 3: PRD Generation
  const prd = await generatePRD(brief, ctoPlan, {
    simulate,
    ...prdOpts,
  });
  savePRD(root, projectId, prd);

  // Phase 4: Architect — PRD + Team → Task Graph
  const tasks = generateTaskGraph(prd, team, projectId);
  savePlan(root, projectId, {
    projectId,
    tasks,
    _enrichment: {
      enriched_at: new Date().toISOString(),
      project_id: projectId,
      prd_version: prd?.meta?.version || null,
      method: 'architect',
    },
  });

  return {
    projectId,
    complexity: ctoPlan.complexity,
    tier: ctoPlan.complexity?.tier || ctoPlan.tier || 'low',
    teamSize: team.members?.length || 0,
    features: prd.features?.length || 0,
    tasks: tasks.length,
    ready: true,
  };
}

// ── Project executor ──────────────────────────────────────────────────────────

/**
 * runProject(root, projectId, opts) → ExecutionResult
 * Loads plan.enriched.json, runs tasks through executeTaskGraph (DAG-aware + gates).
 *
 * opts:
 *   simulate      — simulate mode (skip real LLM calls, gates always pass)
 *   onEvent       — callback(event) for lifecycle events
 *   maxConcurrent — max parallel tasks per wave (default: 1)
 */
export async function runProject(root, projectId, opts = {}) {
  const { simulate: simulateRequested = false, onEvent = null, maxConcurrent = 1 } = opts;
  const simulate = false;
  if (simulateRequested) {
    console.warn('[project-executor] simulate requested but disabled — forcing real API calls');
  }

  // Load enriched plan
  const plan = loadPlan(root, projectId);
  if (!plan) {
    return {
      success: false,
      error: 'plan.enriched.json not found — run launchProjectPipeline first',
      tasks: [],
    };
  }

  const tasks = topologicalSort(plan.tasks || []);

  const result = await executeTaskGraph(root, projectId, tasks, {
    simulate,
    onEvent,
    maxConcurrent,
  });

  // ── Finalize memory (Slice 424) ─────────────────────────────────────────────
  try { await finalizeProjectMemory(root); } catch { /* non-fatal */ }

  // ── Aggregate metrics (Slice 426) ───────────────────────────────────────────
  try { aggregateMetrics(root, projectId); } catch { /* non-fatal */ }

  return result;
}
