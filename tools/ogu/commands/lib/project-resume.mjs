/**
 * project-resume.mjs — Slice 429
 * Checkpoint-based project resume.
 *
 * Reads execution-state.json and resumes execution from the last checkpoint.
 * Completed tasks are skipped; pending/failed/skipped tasks are re-evaluated.
 *
 * Resume semantics:
 *   - "completed" tasks are never re-run
 *   - "failed" tasks are retried (unless skip_failed=true)
 *   - "skipped" tasks caused by failed deps are re-evaluated (dep may be fixed)
 *   - "running" tasks (interrupted mid-run) are reset to pending and retried
 *
 * Exports:
 *   canResume(root, projectId) → boolean
 *   getResumePoint(root, projectId) → ResumePoint | null
 *   getUnfinishedTasks(executionState, allTasks) → Task[]
 *   resumeProject(root, projectId, opts) → ExecutionResult
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectsDir } from './runtime-paths.mjs';
import { executeTaskGraph } from './task-graph-executor.mjs';
import { topologicalSort } from './project-executor.mjs';

// ── State helpers ─────────────────────────────────────────────────────────────

function readState(root, projectId) {
  const path = join(getProjectsDir(root), projectId, 'execution-state.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

function readEnrichedPlan(root, projectId) {
  const path = join(getProjectsDir(root), projectId, 'plan.enriched.json');
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch { return null; }
}

// ── canResume ─────────────────────────────────────────────────────────────────

/**
 * canResume(root, projectId) → boolean
 * True when there is an interrupted or partial execution that can be continued.
 */
export function canResume(root, projectId) {
  const state = readState(root, projectId);
  if (!state) return false;

  // Nothing to resume if already completed successfully
  if (state.status === 'completed') return false;

  // Has at least one task that can be retried
  const tasks = Object.values(state.tasks || {});
  return tasks.some(t =>
    t.status === 'pending' ||
    t.status === 'running' ||   // interrupted
    t.status === 'failed' ||
    t.status === 'skipped'      // may be unblocked now
  );
}

// ── getResumePoint ────────────────────────────────────────────────────────────

/**
 * getResumePoint(root, projectId) → ResumePoint | null
 *
 * ResumePoint: {
 *   projectId, status, startedAt, resumeFrom,
 *   completedCount, failedCount, pendingCount, skippedCount,
 *   completedTasks: string[],
 *   failedTasks: string[],
 *   pendingTasks: string[],
 *   skippedTasks: string[],
 * }
 */
export function getResumePoint(root, projectId) {
  const state = readState(root, projectId);
  if (!state) return null;

  const completedTasks = [];
  const failedTasks = [];
  const pendingTasks = [];
  const skippedTasks = [];

  for (const [tid, ts] of Object.entries(state.tasks || {})) {
    switch (ts.status) {
      case 'completed': completedTasks.push(tid); break;
      case 'failed':    failedTasks.push(tid);    break;
      case 'running':   // treat interrupted as pending
      case 'pending':   pendingTasks.push(tid);   break;
      case 'skipped':   skippedTasks.push(tid);   break;
    }
  }

  return {
    projectId,
    status: state.status,
    startedAt: state.startedAt,
    resumeFrom: new Date().toISOString(),
    completedCount: completedTasks.length,
    failedCount: failedTasks.length,
    pendingCount: pendingTasks.length,
    skippedCount: skippedTasks.length,
    completedTasks,
    failedTasks,
    pendingTasks,
    skippedTasks,
  };
}

// ── getUnfinishedTasks ────────────────────────────────────────────────────────

/**
 * getUnfinishedTasks(executionState, allTasks, opts) → Task[]
 *
 * Returns tasks that are NOT completed, filtered from allTasks.
 * "running" tasks (interrupted) are reset to pending.
 *
 * opts.skipFailed — if true, exclude failed tasks from result (don't retry them)
 */
export function getUnfinishedTasks(executionState, allTasks, opts = {}) {
  const { skipFailed = false } = opts;

  if (!executionState || !Array.isArray(allTasks)) return allTasks || [];

  const taskStates = executionState.tasks || {};

  return allTasks.filter(task => {
    const tid = task.id || task.task_id;
    const ts = taskStates[tid];

    if (!ts) return true; // not in state → treat as pending

    if (ts.status === 'completed') return false; // skip

    if (ts.status === 'failed') return !skipFailed; // retry unless skipFailed

    // pending, running (interrupted), skipped → include
    return true;
  });
}

// ── buildResumeState ──────────────────────────────────────────────────────────

/**
 * buildResumeState(existingState, allTasks) → state with interrupted tasks reset to pending
 */
function buildResumeState(existingState, allTasks) {
  const resumeState = JSON.parse(JSON.stringify(existingState)); // deep clone

  for (const task of allTasks) {
    const tid = task.id || task.task_id;
    const ts = resumeState.tasks?.[tid];
    if (!ts) continue;

    // Reset interrupted tasks
    if (ts.status === 'running') {
      resumeState.tasks[tid] = { status: 'pending' };
    }

    // Reset skipped-due-to-dep-failed so they get re-evaluated
    if (ts.status === 'skipped' && ts.reason === 'dependency_failed') {
      resumeState.tasks[tid] = { status: 'pending' };
    }
  }

  return resumeState;
}

// ── resumeProject ─────────────────────────────────────────────────────────────

/**
 * resumeProject(root, projectId, opts) → ExecutionResult
 *
 * Loads execution state and enriched plan, then continues execution
 * from the last checkpoint using executeTaskGraph.
 *
 * opts:
 *   simulate     — pass to executeTaskGraph
 *   onEvent      — event callback
 *   skipFailed   — skip previously failed tasks instead of retrying
 *   maxConcurrent
 */
export async function resumeProject(root, projectId, opts = {}) {
  const { simulate = false, onEvent = null, skipFailed = false, maxConcurrent = 1 } = opts;

  // Load existing state
  const existingState = readState(root, projectId);
  if (!existingState) {
    return {
      success: false,
      error: 'No execution state found — run project first',
      projectId,
      tasks: [],
      summary: null,
    };
  }

  if (existingState.status === 'completed') {
    return {
      success: true,
      projectId,
      alreadyComplete: true,
      tasks: [],
      summary: existingState.summary,
    };
  }

  // Load enriched plan
  const plan = readEnrichedPlan(root, projectId);
  if (!plan) {
    return {
      success: false,
      error: 'plan.enriched.json not found — cannot resume',
      projectId,
      tasks: [],
      summary: null,
    };
  }

  const allTasks = topologicalSort(plan.tasks || []);

  // Get unfinished tasks
  const unfinishedTasks = getUnfinishedTasks(existingState, allTasks, { skipFailed });

  if (unfinishedTasks.length === 0) {
    return {
      success: true,
      projectId,
      alreadyComplete: true,
      tasks: [],
      summary: existingState.summary || { total: allTasks.length, completed: allTasks.length, failed: 0, skipped: 0, success: true },
    };
  }

  // Build resume state (reset running/skipped tasks to pending)
  const resumeState = buildResumeState(existingState, allTasks);

  // Delegate to executeTaskGraph with resume state
  return executeTaskGraph(root, projectId, allTasks, {
    simulate,
    onEvent,
    maxConcurrent,
    existingState: resumeState,
  });
}
