/**
 * Error Recovery — error classification, retry strategies, and DAG rewind.
 *
 * Core functions:
 *   classifyError(error)           — Categorize an error by code/message
 *   getRetryStrategy(category)     — Get retry config for error category
 *   computeRewindPoint(taskId, dag) — Find DAG rewind target after failure
 */

/**
 * Error categories and their OGU error code prefixes.
 */
const ERROR_CATEGORIES = {
  budget:     { codes: ['OGU0401', 'OGU0402'], retryable: false, description: 'Budget/cost limit exceeded' },
  transient:  { codes: ['OGU0500', 'OGU0502', 'OGU0503', 'OGU0429'], retryable: true, description: 'Transient/timeout/rate-limit error' },
  validation: { codes: ['OGU0301', 'OGU0302', 'OGU0303'], retryable: false, description: 'Validation/gate failure' },
  quality:    { codes: ['OGU0601', 'OGU0602'], retryable: true, description: 'Quality check failed — escalate to higher tier' },
  permission: { codes: ['OGU0403', 'OGU0404'], retryable: false, description: 'Permission/governance denied' },
  conflict:   { codes: ['OGU0409'], retryable: true, description: 'File lock conflict — retry after backoff' },
  unknown:    { codes: [], retryable: false, description: 'Unknown error' },
};

/**
 * Classify an error by its code or message.
 *
 * @param {object} error — { code: string, message: string }
 * @returns {{ category: string, retryable: boolean, description: string }}
 */
export function classifyError(error) {
  const code = error.code || '';
  const message = (error.message || '').toLowerCase();

  // Match by error code
  for (const [category, config] of Object.entries(ERROR_CATEGORIES)) {
    if (config.codes.includes(code)) {
      return { category, retryable: config.retryable, description: config.description };
    }
  }

  // Match by message keywords
  if (message.includes('budget') || message.includes('cost') || message.includes('limit exceeded')) {
    return { ...ERROR_CATEGORIES.budget, category: 'budget' };
  }
  if (message.includes('timeout') || message.includes('rate limit') || message.includes('503') || message.includes('429')) {
    return { ...ERROR_CATEGORIES.transient, category: 'transient' };
  }
  if (message.includes('gate') || message.includes('validation') || message.includes('failed check')) {
    return { ...ERROR_CATEGORIES.validation, category: 'validation' };
  }
  if (message.includes('quality') || message.includes('test failed') || message.includes('lint')) {
    return { ...ERROR_CATEGORIES.quality, category: 'quality' };
  }
  if (message.includes('permission') || message.includes('denied') || message.includes('blocked')) {
    return { ...ERROR_CATEGORIES.permission, category: 'permission' };
  }
  if (message.includes('lock') || message.includes('conflict')) {
    return { ...ERROR_CATEGORIES.conflict, category: 'conflict' };
  }

  return { category: 'unknown', retryable: false, description: 'Unknown error' };
}

/**
 * Get retry strategy for an error category.
 *
 * @param {string} category — Error category from classifyError
 * @returns {{ maxRetries: number, backoffMs: number, escalate: boolean, strategy: string }}
 */
export function getRetryStrategy(category) {
  const strategies = {
    transient: {
      maxRetries: 3,
      backoffMs: 2000,
      escalate: false,
      strategy: 'exponential-backoff',
      description: 'Retry with exponential backoff (2s, 4s, 8s)',
    },
    conflict: {
      maxRetries: 5,
      backoffMs: 1000,
      escalate: false,
      strategy: 'linear-backoff',
      description: 'Wait for lock release, retry with linear backoff',
    },
    quality: {
      maxRetries: 2,
      backoffMs: 0,
      escalate: true,
      strategy: 'escalate-tier',
      description: 'Escalate to higher model tier and retry',
    },
    budget: {
      maxRetries: 0,
      backoffMs: 0,
      escalate: false,
      strategy: 'halt',
      description: 'Stop execution — budget exceeded',
    },
    validation: {
      maxRetries: 0,
      backoffMs: 0,
      escalate: false,
      strategy: 'halt-fix',
      description: 'Stop — requires manual fix or spec change',
    },
    permission: {
      maxRetries: 0,
      backoffMs: 0,
      escalate: false,
      strategy: 'halt-approval',
      description: 'Stop — requires approval before retry',
    },
    unknown: {
      maxRetries: 1,
      backoffMs: 5000,
      escalate: false,
      strategy: 'cautious-retry',
      description: 'Single cautious retry with long backoff',
    },
  };

  return strategies[category] || strategies.unknown;
}

/**
 * Compute the DAG rewind point after a task failure.
 *
 * @param {string} failedTaskId — ID of the failed task
 * @param {object} dag — DAG structure { waves: string[][], tasks: Array<{id, dependsOn}> }
 * @returns {{ rewindToWave: number, tasksToRerun: string[], reason: string }}
 */
export function computeRewindPoint(failedTaskId, dag) {
  const { waves, tasks } = dag;

  // Find which wave the failed task is in
  let failedWave = -1;
  for (let i = 0; i < waves.length; i++) {
    if (waves[i].includes(failedTaskId)) {
      failedWave = i;
      break;
    }
  }

  if (failedWave === -1) {
    return { rewindToWave: 0, tasksToRerun: [failedTaskId], reason: 'Task not found in DAG — rewind to start' };
  }

  // Find the failed task's dependencies
  const failedTask = tasks.find(t => t.id === failedTaskId);
  const deps = failedTask?.dependsOn || [];

  if (deps.length === 0) {
    // Root task — rewind to its own wave, retry just this task
    return {
      rewindToWave: failedWave,
      tasksToRerun: [failedTaskId],
      reason: `Root task failed — retry in wave ${failedWave}`,
    };
  }

  // Find which wave the dependencies are in
  let depWave = 0;
  for (const dep of deps) {
    for (let i = 0; i < waves.length; i++) {
      if (waves[i].includes(dep)) {
        depWave = Math.max(depWave, i);
      }
    }
  }

  // Rewind to the dependency wave — rerun deps + failed task
  const tasksToRerun = [...deps, failedTaskId];

  return {
    rewindToWave: depWave,
    tasksToRerun,
    reason: `Rewind to wave ${depWave} — rerun ${tasksToRerun.join(', ')}`,
  };
}
